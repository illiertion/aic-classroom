import { Hono } from "hono";
import type { AppEnv, Env } from "../types";
import { sha256Hex, timingSafeEqual } from "../lib/crypto";
import {
  clearSession,
  clientKey,
  issueSession,
  requireTeacher,
  throttle,
  assertSameOrigin,
  TEACHER_ID,
} from "../lib/auth";
import { ApiError } from "../lib/errors";
import { safeJson } from "../lib/db";
import type { TeacherProfile } from "../../../shared/protocol";

const auth = new Hono<AppEnv>();

const OWNER_ID = TEACHER_ID;
const OWNER_EMAIL = "owner@local";

/**
 * The app has exactly one teacher identity. The password itself never lives in
 * D1 or the bundle: it comes from the Worker environment (Cloudflare secret
 * TEACHER_PASSWORD), and successful entry issues the same signed session
 * cookie used by the classroom APIs.
 *
 * The display name is created once from `TEACHER_NAME` and can then be changed
 * in the app (PATCH /auth/profile), so a later login must not overwrite it.
 */
async function ownerName(env: Env, fallback: string): Promise<string> {
  await env.DB.prepare(
    `INSERT INTO teachers (id, email, name, password_hash, created_at)
     VALUES (?, ?, ?, '', ?)
     ON CONFLICT (id) DO NOTHING`,
  )
    .bind(OWNER_ID, OWNER_EMAIL, fallback, Date.now())
    .run();
  const row = await env.DB.prepare("SELECT name FROM teachers WHERE id = ?")
    .bind(OWNER_ID)
    .first<{ name: string }>();
  return (row?.name ?? "").trim().slice(0, 40) || fallback;
}

function cleanName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
}

auth.post("/login", async (c) => {
  assertSameOrigin(c);
  throttle(clientKey(c, "login"), 10, 5 * 60_000);
  const expected = c.env.TEACHER_PASSWORD;
  if (!expected || expected.length < 8) {
    throw new ApiError(
      503,
      "password_not_configured",
      "선생님 비밀번호가 아직 설정되지 않았습니다. Cloudflare에 TEACHER_PASSWORD를 추가해 주세요.",
    );
  }
  const body = await safeJson<{ password?: unknown }>(c);
  if (!body || typeof body.password !== "string" || body.password.length > 200) {
    throw new ApiError(400, "invalid_body", "비밀번호를 입력해 주세요.");
  }
  const given = await sha256Hex(body.password);
  const wanted = await sha256Hex(expected);
  if (!timingSafeEqual(given, wanted)) {
    throw new ApiError(401, "invalid_password", "비밀번호가 올바르지 않습니다.");
  }

  const fallback = (c.env.TEACHER_NAME ?? "").trim().slice(0, 40) || "선생님";
  const name = await ownerName(c.env, fallback);
  await issueSession(c, { id: OWNER_ID, name, email: "" });
  const profile: TeacherProfile = { id: OWNER_ID, name, email: "" };
  return c.json({ teacher: profile });
});

auth.post("/logout", async (c) => {
  assertSameOrigin(c);
  clearSession(c);
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const session = await requireTeacher(c);
  const name = await ownerName(c.env, cleanName(session.name) || "선생님");
  const profile: TeacherProfile = {
    id: OWNER_ID,
    name,
    email: "",
  };
  return c.json({ teacher: profile });
});

/** 선생님 표시 이름 변경. 세션 쿠키도 새 이름으로 다시 발급합니다. */
auth.patch("/profile", async (c) => {
  assertSameOrigin(c);
  await requireTeacher(c);
  const body = await safeJson<{ name?: unknown }>(c);
  const name = cleanName(body?.name);
  if (!name) {
    throw new ApiError(400, "invalid_name", "선생님 이름을 입력해 주세요.");
  }
  await ownerName(c.env, name);
  await c.env.DB.prepare("UPDATE teachers SET name = ? WHERE id = ?").bind(name, OWNER_ID).run();
  await issueSession(c, { id: OWNER_ID, name, email: "" });
  const profile: TeacherProfile = { id: OWNER_ID, name, email: "" };
  return c.json({ teacher: profile });
});

export default auth;
