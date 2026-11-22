import { Hono } from "hono";
import type { AppEnv, Env } from "../types";
import { randomId, sha256Hex, timingSafeEqual } from "../lib/crypto";
import {
  clearSession,
  clientKey,
  findTeacherByCode,
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
 * 선생님 계정은 두 가지로 들어옵니다.
 *
 * 1. `TEACHER_PASSWORD`(Cloudflare secret) — 이 앱의 원래 주인 계정(`tch_owner`).
 * 2. 이름 + 액세스 코드 — 같은 앱을 함께 쓰는 다른 선생님들. 각자 자기 수업만 봅니다.
 *
 * 액세스 코드는 서버가 만들어 주고 4~12자 영문/숫자이며, D1 `teachers` 테이블에
 * 해시 없이 그대로 저장됩니다(코드만으로도 들어올 수 있으므로 비밀번호와 같은 취급).
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

function cleanCode(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
}

/** 헷갈리는 글자(0/O, 1/I)를 뺀 코드 생성. */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function profileOf(env: Env, id: string): Promise<TeacherProfile> {
  const row = await env.DB.prepare("SELECT id, name, access_code FROM teachers WHERE id = ?")
    .bind(id)
    .first<{ id: string; name: string; access_code: string | null }>();
  if (!row) throw new ApiError(401, "teacher_missing", "선생님 계정을 찾을 수 없습니다.");
  return { id: row.id, name: row.name, email: "", accessCode: row.access_code };
}

/** 액세스 코드 로그인 + 이름 기반 새 계정 만들기. */
auth.post("/login", async (c) => {
  assertSameOrigin(c);
  throttle(clientKey(c, "login"), 10, 5 * 60_000);
  const body = await safeJson<{ password?: unknown; accessCode?: unknown; name?: unknown }>(c);
  const name = cleanName(body?.name);
  const code = cleanCode(body?.accessCode);

  // 1) 이름 + 액세스 코드
  if (code) {
    const teacher = await findTeacherByCode(c.env, code);
    if (!teacher) {
      throw new ApiError(401, "invalid_code", "액세스 코드가 올바르지 않습니다.");
    }
    if (name && name !== teacher.name) {
      // 이름은 표시용일 뿐이므로 다르면 맞춰 줍니다.
      await c.env.DB.prepare("UPDATE teachers SET name = ? WHERE id = ?")
        .bind(name, teacher.id)
        .run();
    }
    const finalName = name || teacher.name;
    await issueSession(c, { id: teacher.id, name: finalName, email: "" });
    return c.json({ teacher: await profileOf(c.env, teacher.id) });
  }

  // 2) 기존 방식: 앱 비밀번호
  const expected = c.env.TEACHER_PASSWORD;
  if (!expected || expected.length < 8) {
    throw new ApiError(
      503,
      "password_not_configured",
      "선생님 비밀번호가 아직 설정되지 않았습니다. Cloudflare에 TEACHER_PASSWORD를 추가해 주세요.",
    );
  }
  if (typeof body?.password !== "string" || body.password.length > 200) {
    throw new ApiError(400, "invalid_body", "비밀번호를 입력해 주세요.");
  }
  const given = await sha256Hex(body.password);
  const wanted = await sha256Hex(expected);
  if (!timingSafeEqual(given, wanted)) {
    throw new ApiError(401, "invalid_password", "비밀번호가 올바르지 않습니다.");
  }
  const fallback = (c.env.TEACHER_NAME ?? "").trim().slice(0, 40) || "선생님";
  const resolved = await ownerName(c.env, fallback);
  await issueSession(c, { id: OWNER_ID, name: resolved, email: "" });
  return c.json({ teacher: await profileOf(c.env, OWNER_ID) });
});

/** 새 선생님 계정 만들기: 이름만 넣으면 액세스 코드를 발급합니다. */
auth.post("/register", async (c) => {
  assertSameOrigin(c);
  throttle(clientKey(c, "register"), 6, 10 * 60_000);
  const body = await safeJson<{ name?: unknown; accessCode?: unknown }>(c);
  const name = cleanName(body?.name);
  if (!name) throw new ApiError(400, "invalid_name", "선생님 이름을 입력해 주세요.");

  const wanted = cleanCode(body?.accessCode);
  if (wanted && (await findTeacherByCode(c.env, wanted))) {
    throw new ApiError(409, "code_taken", "이미 사용 중인 액세스 코드입니다. 다른 코드를 넣어 주세요.");
  }

  let code = wanted || generateCode();
  for (let attempt = 0; attempt < 8 && !wanted; attempt += 1) {
    if (!(await findTeacherByCode(c.env, code))) break;
    code = generateCode();
  }

  const id = randomId("tch_");
  await c.env.DB.prepare(
    `INSERT INTO teachers (id, email, name, password_hash, created_at, access_code)
     VALUES (?, ?, ?, '', ?, ?)`,
  )
    .bind(id, `${id}@local`, name, Date.now(), code)
    .run();
  await issueSession(c, { id, name, email: "" });
  return c.json({ teacher: await profileOf(c.env, id), accessCode: code }, 201);
});

auth.post("/logout", async (c) => {
  assertSameOrigin(c);
  clearSession(c);
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const session = await requireTeacher(c);
  if (session.tid === OWNER_ID) {
    await ownerName(c.env, cleanName(session.name) || "선생님");
  }
  return c.json({ teacher: await profileOf(c.env, session.tid) });
});

/** 선생님 표시 이름 변경. 세션 쿠키도 새 이름으로 다시 발급합니다. */
auth.patch("/profile", async (c) => {
  assertSameOrigin(c);
  const session = await requireTeacher(c);
  const body = await safeJson<{ name?: unknown }>(c);
  const name = cleanName(body?.name);
  if (!name) {
    throw new ApiError(400, "invalid_name", "선생님 이름을 입력해 주세요.");
  }
  await c.env.DB.prepare("UPDATE teachers SET name = ? WHERE id = ?").bind(name, session.tid).run();
  await issueSession(c, { id: session.tid, name, email: "" });
  return c.json({ teacher: await profileOf(c.env, session.tid) });
});

/** 액세스 코드 재발급(코드가 새어 나갔을 때). */
auth.post("/rotate-code", async (c) => {
  assertSameOrigin(c);
  const session = await requireTeacher(c);
  if (session.tid === OWNER_ID) {
    throw new ApiError(400, "owner_has_no_code", "이 계정은 비밀번호로 들어옵니다.");
  }
  let code = generateCode();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!(await findTeacherByCode(c.env, code))) break;
    code = generateCode();
  }
  await c.env.DB.prepare("UPDATE teachers SET access_code = ? WHERE id = ?")
    .bind(code, session.tid)
    .run();
  return c.json({ teacher: await profileOf(c.env, session.tid), accessCode: code });
});

export default auth;
