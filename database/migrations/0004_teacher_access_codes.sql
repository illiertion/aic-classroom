-- 선생님 계정: 이름 + 액세스 코드로 각자 로그인하고, 자기 수업만 봅니다.
ALTER TABLE teachers ADD COLUMN access_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_access_code
  ON teachers (access_code)
  WHERE access_code IS NOT NULL;
