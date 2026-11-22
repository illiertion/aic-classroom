import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import type { SessionPayload } from "./lib/auth";

export interface Env {
  DB: D1Database;
  CLASSROOM_HUB: DurableObjectNamespace;
  ASSETS: Fetcher;
  APP_NAME: string;
  SESSION_SECRET?: string;
  /** Cloudflare secret: the only teacher entry password. Never stored in D1. */
  TEACHER_PASSWORD?: string;
  TEACHER_NAME?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    teacher: SessionPayload;
  };
};

export interface TeacherRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: number;
}

export interface ClassroomRow {
  id: string;
  teacher_id: string;
  title: string;
  subject: string;
  join_code: string;
  status: "live" | "ended";
  require_fullscreen: number;
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
}

export interface ParticipantRow {
  id: string;
  classroom_id: string;
  name: string;
  token_hash: string;
  joined_at: number;
  last_seen_at: number;
  last_rejoin_at: number | null;
}
