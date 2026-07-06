-- Table for tracking monthly savings/vault balance
CREATE TABLE IF NOT EXISTS vault_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month INT NOT NULL,
  year INT NOT NULL,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  is_manual_adjustment BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE vault_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vault_entries"
  ON vault_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
