import type { Env } from "./types";

const PARTICIPANT_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface RetentionResult {
  participantsDeleted: number;
}

/**
 * Retention sweep (daily cron). D1 holds no files and no recording media, so
 * the only periodic job is removing temporary participants of ended classes.
 */
export async function runRetention(env: Env): Promise<RetentionResult> {
  const participants = await env.DB.prepare(
    `DELETE FROM participants WHERE classroom_id IN (
       SELECT id FROM classrooms WHERE status = 'ended' AND ended_at IS NOT NULL AND ended_at < ?
     )`,
  )
    .bind(Date.now() - PARTICIPANT_RETENTION_MS)
    .run();
  return { participantsDeleted: participants.meta.changes ?? 0 };
}
