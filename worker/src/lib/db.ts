import type { Context } from "hono";
import type { AppEnv, ClassroomRow, Env, ParticipantRow } from "../types";
import { ApiError, notFound } from "./errors";
import type { ClassroomPublicInfo, ClassroomSettings } from "../../../shared/protocol";

export function safeJson<T>(c: Context<AppEnv>): Promise<T | null> {
  return c.req.json<T>().catch(() => null);
}

export function requireString(value: unknown, max: number, min = 1): string {
  if (typeof value !== "string") throw new ApiError(400, "invalid_input", "값이 올바르지 않습니다.");
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ApiError(400, "invalid_input", `길이는 ${min}~${max}자여야 합니다.`);
  }
  return trimmed;
}

export function optionalString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, max);
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new ApiError(400, "invalid_email", "이메일을 입력해 주세요.");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) {
    throw new ApiError(400, "invalid_email", "이메일 형식이 올바르지 않습니다.");
  }
  return email;
}

export async function findClassroom(env: Env, id: string): Promise<ClassroomRow | null> {
  return env.DB.prepare("SELECT * FROM classrooms WHERE id = ?").bind(id).first<ClassroomRow>();
}

export async function findClassroomByCode(env: Env, code: string): Promise<ClassroomRow | null> {
  return env.DB.prepare("SELECT * FROM classrooms WHERE join_code = ?")
    .bind(code.trim().toUpperCase())
    .first<ClassroomRow>();
}

export async function requireOwnedClassroom(c: Context<AppEnv>, id: string): Promise<ClassroomRow> {
  const classroom = await findClassroom(c.env, id);
  if (!classroom || classroom.teacher_id !== c.get("teacher").tid) throw notFound("수업을 찾을 수 없습니다.");
  return classroom;
}

export async function findTeacherName(env: Env, teacherId: string): Promise<string> {
  const row = await env.DB.prepare("SELECT name FROM teachers WHERE id = ?")
    .bind(teacherId)
    .first<{ name: string }>();
  return row?.name ?? "선생님";
}

export function settingsOf(row: ClassroomRow): ClassroomSettings {
  return {
    requireFullscreen: row.require_fullscreen === 1,
  };
}

export function publicInfoOf(row: ClassroomRow, teacherName: string): ClassroomPublicInfo {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    teacherName,
    status: row.status,
    joinCode: row.join_code,
    ...settingsOf(row),
  };
}

export function classroomCounts(
  env: Env,
  classroomId: string,
): Promise<{ participantCount: number }> {
  return env.DB.prepare("SELECT COUNT(*) AS participant_count FROM participants WHERE classroom_id = ?")
    .bind(classroomId)
    .first<{ participant_count: number }>()
    .then((row) => ({ participantCount: Number(row?.participant_count ?? 0) }));
}

export async function findParticipantByToken(
  env: Env,
  classroomId: string,
  tokenHash: string,
): Promise<ParticipantRow | null> {
  return env.DB.prepare("SELECT * FROM participants WHERE classroom_id = ? AND token_hash = ?")
    .bind(classroomId, tokenHash)
    .first<ParticipantRow>();
}
