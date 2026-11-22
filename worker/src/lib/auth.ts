import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv, Env, ParticipantRow } from "../types";
import { sha256Hex, signPayload, verifySignedPayload } from "./crypto";
import { ApiError, unauthorized } from "./errors";

export const SESSION_COOKIE = "aic_session";
/** The only teacher identity in v4; password entry issues this id. */
export const TEACHER_ID = "tch_owner";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export interface SessionPayload {
  tid: string;
  name: string;
  email: string;
  exp: number;
  [key: string]: unknown;
}

export function sessionSecret(env: Env): string {
  return env.SESSION_SECRET && env.SESSION_SECRET.length >= 16
    ? env.SESSION_SECRET
    : "dev-only-secret-change-before-deploy";
}

export async function issueSession(
  c: Context<AppEnv>,
  teacher: { id: string; name: string; email: string },
): Promise<void> {
  const token = await signPayload(
    {
      tid: teacher.id,
      name: teacher.name,
      email: teacher.email,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    },
    sessionSecret(c.env),
  );
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSession(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function readSession(c: Context<AppEnv>): Promise<SessionPayload | null> {
  const token = getCookie(c, SESSION_COOKIE);
  return verifySignedPayload<SessionPayload>(token, sessionSecret(c.env));
}

export async function requireTeacher(c: Context<AppEnv>): Promise<SessionPayload> {
  const session = await readSession(c);
  if (!session || !session.tid) throw unauthorized();
  const exists = await c.env.DB.prepare("SELECT id FROM teachers WHERE id = ?")
    .bind(session.tid)
    .first<{ id: string }>();
  if (!exists) throw unauthorized();
  c.set("teacher", session);
  return session;
}

/** 액세스 코드로 선생님 계정을 찾습니다(대소문자·공백 무시). */
export async function findTeacherByCode(
  env: Env,
  code: string,
): Promise<{ id: string; name: string; access_code: string } | null> {
  const normalized = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (normalized.length < 4) return null;
  return env.DB.prepare(
    "SELECT id, name, access_code FROM teachers WHERE UPPER(access_code) = ? LIMIT 1",
  )
    .bind(normalized)
    .first<{ id: string; name: string; access_code: string }>();
}

/**
 * Student authentication is header-based and scoped to one temporary
 * participant row. No student cookie, account or persistent profile exists.
 */
export async function requireParticipant(
  c: Context<AppEnv>,
  classroomId?: string,
): Promise<ParticipantRow> {
  const token = c.req.header("x-aic-participant") ?? "";
  if (!token) throw unauthorized("수업 참가 정보가 없습니다. QR 또는 참가 코드로 다시 입장해 주세요.");
  const hash = await sha256Hex(token);
  const row = await c.env.DB.prepare(
    `SELECT * FROM participants WHERE token_hash = ?${classroomId ? " AND classroom_id = ?" : ""}`,
  )
    .bind(...(classroomId ? [hash, classroomId] : [hash]))
    .first<ParticipantRow>();
  if (!row) {
    throw new ApiError(
      401,
      "invalid_participant",
      "참가 정보가 만료되었습니다. 수업에 다시 입장해 주세요.",
    );
  }
  return row;
}

/**
 * Best-effort CSRF hardening: cookie-authenticated mutations require the
 * browser to send a custom header (cross-site forms cannot), and the Origin,
 * when present, must match the request host or an explicit localhost dev host.
 */
export function assertSameOrigin(c: Context<AppEnv>): void {
  if (c.req.method === "GET" || c.req.method === "HEAD") return;
  const marker = c.req.header("x-aic-client");
  const origin = c.req.header("origin");
  if (!origin) {
    if (marker === "web") return;
    throw new ApiError(403, "origin_required", "요청 출처를 확인할 수 없습니다.");
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "origin_invalid", "요청 출처가 올바르지 않습니다.");
  }
  const target = new URL(c.req.url);
  const allowed = new Set([target.host, "localhost:5173", "127.0.0.1:5173"]);
  if (!allowed.has(originHost)) {
    throw new ApiError(403, "origin_mismatch", "다른 출처에서 보낸 요청은 허용되지 않습니다.");
  }
}

/* ---------------------------- rate limiting --------------------------- */

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Per-isolate best-effort throttle. Durable rate limiting belongs at the edge. */
export function throttle(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new ApiError(429, "rate_limited", "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  }
}

export function clientKey(c: Context<AppEnv>, scope: string): string {
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "local";
  return `${scope}:${ip}`;
}
