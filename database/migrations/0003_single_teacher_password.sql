-- v4: no per-teacher accounts. One owner identity is unlocked by
-- TEACHER_PASSWORD (Cloudflare secret). Existing classrooms are moved to the
-- owner before the old account rows are removed.
INSERT OR IGNORE INTO teachers (id, email, name, password_hash, created_at)
VALUES ('tch_owner', 'owner@local', '선생님', '', CAST(strftime('%s', 'now') AS INTEGER) * 1000);

UPDATE classrooms SET teacher_id = 'tch_owner' WHERE teacher_id <> 'tch_owner';
DELETE FROM teachers WHERE id <> 'tch_owner';
