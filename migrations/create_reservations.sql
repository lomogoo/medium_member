-- 施設予約テーブル
-- start_time / end_time は "HH:MM" 形式（1分単位）
CREATE TABLE IF NOT EXISTS reservations (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT        NOT NULL,
  date          DATE        NOT NULL,
  start_time    TEXT        NOT NULL,  -- "HH:MM"
  end_time      TEXT        NOT NULL,  -- "HH:MM"
  created_by    INTEGER     REFERENCES members(id) ON DELETE SET NULL,
  created_by_name TEXT      NOT NULL,
  note          TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reservations_date_idx ON reservations(date);
