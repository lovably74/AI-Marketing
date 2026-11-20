-- 0001 초기 스키마 (PostgreSQL 참고용 — 아직 자동 적용되지 않음). SQLite 버전과 같은 구조.
-- 규약: id는 TEXT(UUID), 시각은 ISO-8601 TEXT, JSON은 TEXT, 이미지 원본은 BLOB(PG: BYTEA)

CREATE TABLE IF NOT EXISTS generations (
  id              TEXT PRIMARY KEY,
  created_at      TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_code      TEXT,
  product_name    TEXT,
  product_info    TEXT,
  target_customer TEXT,
  model_id        TEXT,
  provider        TEXT,
  model           TEXT,
  is_tlink        BOOLEAN,
  attempts        INTEGER,
  elapsed_ms      INTEGER,
  image_mime      TEXT,
  image_size      INTEGER,
  image_sha256    TEXT,
  image_blob      BYTEA,
  result_json     TEXT,
  guideline_json  TEXT
);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations (created_at);

CREATE TABLE IF NOT EXISTS recipients (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  name        TEXT,
  company     TEXT,
  title       TEXT,
  department  TEXT,
  email       TEXT NOT NULL UNIQUE,
  phone       TEXT
);

CREATE TABLE IF NOT EXISTS email_logs (
  id             TEXT PRIMARY KEY,
  created_at     TEXT NOT NULL,
  generation_id  TEXT REFERENCES generations (id) ON DELETE SET NULL,
  recipient_id   TEXT REFERENCES recipients (id) ON DELETE SET NULL,
  subject        TEXT,
  body           TEXT,
  status         TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  message_id     TEXT,
  error_code     TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs (created_at);

CREATE TABLE IF NOT EXISTS export_logs (
  id             TEXT PRIMARY KEY,
  created_at     TEXT NOT NULL,
  generation_id  TEXT REFERENCES generations (id) ON DELETE SET NULL,
  format         TEXT NOT NULL,
  recipient_id   TEXT REFERENCES recipients (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_export_logs_created_at ON export_logs (created_at);
