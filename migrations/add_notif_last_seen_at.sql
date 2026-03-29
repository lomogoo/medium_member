-- membersテーブルに通知既読管理用カラムを追加
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS notif_last_seen_at TIMESTAMPTZ DEFAULT NULL;
