import { Hono } from "hono";
import type { AppEnv } from "../types";
import { assertSameOrigin, clientKey, requireParticipant, throttle } from "../lib/auth";
import { ApiError, notFound } from "../lib/errors";
import { randomToken, sha256Hex, randomId } from "../lib/crypto";
import {
  findClassroomByCode,
  findParticipantByToken,
  findTeacherName,
  optionalString,
  publicInfoOf,
  safeJson,
} from "../lib/db";
import type { JoinResult, StudentSnapshot } from "../../../shared/protocol";
import type { ClassroomHub } from "../do/ClassroomHub";

const join = new Hono<AppEnv>();

join.get("/:code", async (c) => {
  throttle(clientKey(c, "join-preview"), 120, 60_000);
  const row = await findClassroomByCode(c.env, c.req.param("code"));
  if (!row) throw notFound("참가 코드를 확인해 주세요.");
  const teacherName = await findTeacherName(c.env, row.teacher_id);
  return c.json({ classroom: publicInfoOf(row, teacherName) });
});

join.post("/:code", async (c) => {
  assertSameOrigin(c);
  throttle(clientKey(c, "join"), 30, 60_000);
  const row = await findClassroomByCode(c.env, c.req.param("code"));
  if (!row) throw notFound("참가 코드를 확인해 주세요.");
  if (row.status !== "live") {
    throw new ApiError(409, "class_ended", "종료된 수업입니다. 선생님께 새 참가 코드를 요청해 주세요.");
  }
  const body = await safeJson<{ name?: unknown; token?: unknown }>(c);
  if (!body) throw new ApiError(400, "invalid_body", "요청 본문이 올바르지 않습니다.");
  const teacherName = await findTeacherName(c.env, row.teacher_id);

  // Rejoin with the temporary participant token kept on the student device.
  if (typeof body.token === "string" && body.token) {
    const tokenHash = await sha256Hex(body.token);
    const existing = await findParticipantByToken(c.env, row.id, tokenHash);
    if (!existing) {
      const failure: JoinResult = {
        ok: false,
        code: "invalid_token",
        message: "이전 참가 정보를 찾을 수 없습니다. 이름을 다시 입력해 주세요.",
      };
      return c.json(failure, 200);
    }
    const now = Date.now();
    await c.env.DB.prepare(
      "UPDATE participants SET last_seen_at = ?, last_rejoin_at = ? WHERE id = ?",
    )
      .bind(now, now, existing.id)
      .run();
    const result: JoinResult = {
      ok: true,
      participantToken: body.token,
      participant: { id: existing.id, name: existing.name, joinedAt: existing.joined_at, rejoin: true },
      classroom: publicInfoOf(row, teacherName),
    };
    return c.json(result);
  }

  const name = optionalString(body.name, 20);
  if (!name) throw new ApiError(400, "name_required", "이름을 입력해 주세요.");
  const now = Date.now();
  const token = randomToken(24);
  const participantId = randomId("prt_");
  await c.env.DB.prepare(
    "INSERT INTO participants (id, classroom_id, name, token_hash, joined_at, last_seen_at, last_rejoin_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
  )
    .bind(participantId, row.id, name, await sha256Hex(token), now, now)
    .run();

  const result: JoinResult = {
    ok: true,
    participantToken: token,
    participant: { id: participantId, name, joinedAt: now, rejoin: false },
    classroom: publicInfoOf(row, teacherName),
  };
  return c.json(result, 201);
});

join.get("/:code/state", async (c) => {
  const row = await findClassroomByCode(c.env, c.req.param("code"));
  if (!row) throw notFound("참가 코드를 확인해 주세요.");
  const participant = await requireParticipant(c, row.id);
  const stub = c.env.CLASSROOM_HUB.get(c.env.CLASSROOM_HUB.idFromName(row.id)) as unknown as ClassroomHub;
  const snapshot: StudentSnapshot = await stub.studentSnapshot(participant.id);
  return c.json({ snapshot: { ...snapshot, status: row.status } });
});

join.post("/:code/leave", async (c) => {
  assertSameOrigin(c);
  const row = await findClassroomByCode(c.env, c.req.param("code"));
  if (!row) throw notFound("참가 코드를 확인해 주세요.");
  const participant = await requireParticipant(c, row.id);
  const now = Date.now();
  await c.env.DB.prepare("UPDATE participants SET last_seen_at = ? WHERE id = ?")
    .bind(now, participant.id)
    .run();
  const stub = c.env.CLASSROOM_HUB.get(c.env.CLASSROOM_HUB.idFromName(row.id)) as unknown as ClassroomHub;
  try {
    await stub.recordServerEvent(
      participant.id,
      participant.name,
      "leave",
      "브라우저가 페이지를 떠났다고 알렸다.",
    );
  } catch {
    /* best-effort: the socket close handler records the disconnect too */
  }
  return c.json({ ok: true });
});

export default join;
