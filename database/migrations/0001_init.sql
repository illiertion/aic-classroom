-- AIC schema v1
-- Deliberately minimal: D1 stores teacher accounts, classrooms, temporary
-- per-class participants and recording *metadata only*. Live state and the
-- event log live inside the ClassroomHub Durable Object; media lives in R2.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teachers (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS classrooms (
  id                TEXT PRIMARY KEY,
  teacher_id        TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  subject           TEXT NOT NULL DEFAULT '',
  join_code         TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'live',
  require_fullscreen INTEGER NOT NULL DEFAULT 1,
  recording_enabled INTEGER NOT NULL DEFAULT 0,
  recording_purpose TEXT NOT NULL DEFAULT '',
  recording_scope   TEXT NOT NULL DEFAULT '',
  retention_hours   INTEGER NOT NULL DEFAULT 24,
  created_at        INTEGER NOT NULL,
  started_at        INTEGER,
  ended_at          INTEGER
);

CREATE INDEX IF NOT EXISTS idx_classrooms_teacher
  ON classrooms (teacher_id, created_at DESC);

-- Temporary classroom participants. Not student accounts: rows are pruned
-- after the class ends and there is no cross-class identity.
CREATE TABLE IF NOT EXISTS participants (
  id             TEXT PRIMARY KEY,
  classroom_id   TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  token_hash     TEXT NOT NULL,
  joined_at      INTEGER NOT NULL,
  last_seen_at   INTEGER NOT NULL,
  last_rejoin_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_participants_classroom
  ON participants (classroom_id, joined_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_token
  ON participants (token_hash);

-- Recording metadata only. Media bytes are never written to D1.
CREATE TABLE IF NOT EXISTS recordings (
  id             TEXT PRIMARY KEY,
  classroom_id   TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  student_name   TEXT NOT NULL,
  status         TEXT NOT NULL,
  mime           TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL DEFAULT 0,
  duration_ms    INTEGER NOT NULL DEFAULT 0,
  chunk_count    INTEGER NOT NULL DEFAULT 0,
  storage_key    TEXT,
  verified       INTEGER NOT NULL DEFAULT 0,
  kept           INTEGER NOT NULL DEFAULT 0,
  interrupted    INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  created_at     INTEGER NOT NULL,
  completed_at   INTEGER,
  expires_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recordings_classroom
  ON recordings (classroom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_expiry
  ON recordings (kept, expires_at);
