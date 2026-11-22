import { Hono } from "hono";
import type { AppEnv, ClassroomRow } from "../types";
import { assertSameOrigin, requireTeacher } from "../lib/auth";
import { badRequest } from "../lib/errors";
import { randomId, randomJoinCode } from "../lib/crypto";
import {
  asBoolean,
  clampNumber,
  classroomCounts,
  optionalString,
  requireOwnedClassroom,
  requireString,
  safeJson,
  settingsOf,
} from "../lib/db";
import type {
  ClassroomSnapshot,
  ClassroomSummary,
  ClassroomEventRecord,
} from "../../../shared/protocol";
import { ClassroomHub } from "../do/ClassroomHub";

const classrooms = new Hono<AppEnv>();

function summary(row: ClassroomRow, counts: { participantCount: number }): ClassroomSummary {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    joinCode: row.join_code,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    participantCount: counts.participantCount,
    ...settingsOf(row),
  };
}

classrooms.get("/", async (c) => {
  const session = await requireTeacher(c);
  const rows = await c.env.DB.prepare(
    `SELECT c.*,
       (SELECT COUNT(*) FROM participants p WHERE p.classroom_id = c.id) AS participant_count
     FROM classrooms c
     WHERE c.teacher_id = ?
     ORDER BY c.created_at DESC
     LIMIT 100`,
  )
    .bind(session.tid)
    .all<ClassroomRow & { participant_count: number }>();
  return c.json({
    classrooms: rows.results.map((row) =>
      summary(row, {
        participantCount: Number(row.participant_count ?? 0),
      }),
    ),
  });
});

classrooms.post("/", async (c) => {
  assertSameOrigin(c);
  const session = await requireTeacher(c);
  const body = await safeJson<{ title?: unknown; subject?: unknown }>(c);
  if (!body) throw badRequest("요청 본문이 올바르지 않습니다.");
  const title = requireString(body.title, 60);
  const subject = optionalString(body.subject, 40) ?? "";
  const now = Date.now();

  let joinCode = randomJoinCode();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const clash = await c.env.DB.prepare("SELECT id FROM classrooms WHERE join_code = ?")
      .bind(joinCode)
      .first<{ id: string }>();
    if (!clash) break;
    joinCode = randomJoinCode();
  }

  const row: ClassroomRow = {
    id: randomId("cls_"),
    teacher_id: session.tid,
    title,
    subject,
    join_code: joinCode,
    status: "live",
    require_fullscreen: 1,
    created_at: now,
    started_at: now,
    ended_at: null,
  };

  await c.env.DB.prepare(
    `INSERT INTO classrooms
      (id, teacher_id, title, subject, join_code, status, require_fullscreen, created_at, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.id,
      row.teacher_id,
      row.title,
      row.subject,
      row.join_code,
      row.status,
      row.require_fullscreen,
      row.created_at,
      row.started_at,
      row.ended_at,
    )
    .run();

  return c.json({ classroom: summary(row, { participantCount: 0 }) }, 201);
});

classrooms.get("/:id", async (c) => {
  await requireTeacher(c);
  const row = await requireOwnedClassroom(c, c.req.param("id"));
  const counts = await classroomCounts(c.env, row.id);
  return c.json({ classroom: summary(row, counts) });
});

classrooms.patch("/:id", async (c) => {
  assertSameOrigin(c);
  await requireTeacher(c);
  const row = await requireOwnedClassroom(c, c.req.param("id"));
  const body = await safeJson<Record<string, unknown>>(c);
  if (!body) throw badRequest("요청 본문이 올바르지 않습니다.");

  const title = body.title !== undefined ? requireString(body.title, 60) : row.title;
  const subject = body.subject !== undefined ? (optionalString(body.subject, 40) ?? "") : row.subject;
  const requireFullscreen =
    body.requireFullscreen !== undefined ? asBoolean(body.requireFullscreen, true) : row.require_fullscreen === 1;

  await c.env.DB.prepare(
    `UPDATE classrooms SET title = ?, subject = ?, require_fullscreen = ? WHERE id = ?`,
  )
    .bind(title, subject, requireFullscreen ? 1 : 0, row.id)
    .run();

  const updated: ClassroomRow = {
    ...row,
    title,
    subject,
    require_fullscreen: requireFullscreen ? 1 : 0,
  };
  const counts = await classroomCounts(c.env, row.id);
  return c.json({ classroom: summary(updated, counts) });
});

classrooms.post("/:id/start", async (c) => {
  assertSameOrigin(c);
  await requireTeacher(c);
  const row = await requireOwnedClassroom(c, c.req.param("id"));
  if (row.status === "live") {
    const counts = await classroomCounts(c.env, row.id);
    return c.json({ classroom: summary(row, counts) });
  }
  const now = Date.now();
  await c.env.DB.prepare(
    "UPDATE classrooms SET status = 'live', started_at = ?, ended_at = NULL WHERE id = ?",
  )
    .bind(now, row.id)
    .run();
  const counts = await classroomCounts(c.env, row.id);
  return c.json({
    classroom: summary({ ...row, status: "live", started_at: now, ended_at: null }, counts),
  });
});

classrooms.post("/:id/end", async (c) => {
  assertSameOrigin(c);
  await requireTeacher(c);
  const row = await requireOwnedClassroom(c, c.req.param("id"));
  const now = Date.now();
  await c.env.DB.prepare("UPDATE classrooms SET status = 'ended', ended_at = ? WHERE id = ?")
    .bind(now, row.id)
    .run();
  const stub = c.env.CLASSROOM_HUB.get(c.env.CLASSROOM_HUB.idFromName(row.id)) as unknown as ClassroomHub;
  try {
    await stub.endClass();
  } catch {
    /* The class is already ended in D1; live sockets will fail closed. */
  }
  // Immediate destruction: temporary participants and their tokens are gone,
  // not kept for the daily retention sweep.
  await c.env.DB.prepare("DELETE FROM participants WHERE classroom_id = ?")
    .bind(row.id)
    .run();
  const counts = await classroomCounts(c.env, row.id);
  return c.json({
    classroom: summary({ ...row, status: "ended", ended_at: now }, counts),
  });
});

classrooms.delete("/:id", async (c) => {
  assertSameOrigin(c);
  await requireTeacher(c);
  const row = await requireOwnedClassroom(c, c.req.param("id"));
  const stub = c.env.CLASSROOM_HUB.get(c.env.CLASSROOM_HUB.idFromName(row.id)) as unknown as ClassroomHub;
  try {
    await stub.endClass();
  } catch {
    /* live state may already be gone */
  }
  await c.env.DB.prepare("DELETE FROM participants WHERE classroom_id = ?").bind(row.id).run();
  await c.env.DB.prepare("DELETE FROM classrooms WHERE id = ?").bind(row.id).run();
  return c.json({ ok: true });
});

classrooms.get("/:id/state", async (c) => {
  await requireTeacher(c);
  const row = await requireOwnedClassroom(c, c.req.param("id"));
  const stub = c.env.CLASSROOM_HUB.get(c.env.CLASSROOM_HUB.idFromName(row.id)) as unknown as ClassroomHub;
  const snapshot = await stub.teacherSnapshot();
  const withStatus: ClassroomSnapshot = { ...snapshot, status: row.status };
  return c.json({ snapshot: withStatus });
});

classrooms.get("/:id/events", async (c) => {
  await requireTeacher(c);
  const row = await requireOwnedClassroom(c, c.req.param("id"));
  const participantId = c.req.query("participantId") ?? null;
  const limit = clampNumber(c.req.query("limit"), 1, 300, 100);
  const stub = c.env.CLASSROOM_HUB.get(c.env.CLASSROOM_HUB.idFromName(row.id)) as unknown as ClassroomHub;
  const events: ClassroomEventRecord[] = await stub.eventHistory(participantId, limit);
  return c.json({ events });
});

export default classrooms;
