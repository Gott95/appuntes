-- Add monthly_budget to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(12,2) DEFAULT 0;

-- Table for tracking weekly overspend re-adjustments
CREATE TABLE IF NOT EXISTS budget_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month INT NOT NULL,
  year INT NOT NULL,
  week_number INT NOT NULL,
  original_amount NUMERIC(12,2) NOT NULL,
  adjusted_amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year, week_number)
);

ALTER TABLE budget_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own budget_overrides"
  ON budget_overrides FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
