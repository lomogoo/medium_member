-- schedules テーブルに一時不在時間帯を格納する gaps 列を追加
-- gaps は JSON 配列: [{"start": "14:30", "end": "15:30"}, ...]
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS gaps JSONB NOT NULL DEFAULT '[]';
