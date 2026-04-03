-- 施設予約テーブル（新規作成 or カラム追加）
CREATE TABLE IF NOT EXISTS reservations (
  id              BIGSERIAL    PRIMARY KEY,
  title           TEXT         NOT NULL,
  date            DATE         NOT NULL,
  start_time      TEXT         NOT NULL DEFAULT '09:00',
  end_time        TEXT         NOT NULL DEFAULT '18:00',
  created_by      UUID         REFERENCES members(id) ON DELETE SET NULL,
  created_by_name TEXT         NOT NULL DEFAULT '',
  status          TEXT         NOT NULL DEFAULT '',
  user_name       TEXT         NOT NULL DEFAULT '',
  event_format    TEXT         NOT NULL DEFAULT '',
  event_url       TEXT         NOT NULL DEFAULT '',
  note            TEXT         NOT NULL DEFAULT '',
  um_staff        TEXT         NOT NULL DEFAULT '',
  cs5_staff       TEXT         NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- すでにテーブルが存在する場合は列を追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT '';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS user_name    TEXT NOT NULL DEFAULT '';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS event_format TEXT NOT NULL DEFAULT '';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS event_url    TEXT NOT NULL DEFAULT '';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS um_staff     TEXT NOT NULL DEFAULT '';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cs5_staff    TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS reservations_date_idx ON reservations(date);
