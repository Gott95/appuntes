-- Limpiar tablas viejas si existen
DROP TABLE IF EXISTS household_activity CASCADE;
DROP TABLE IF EXISTS household_messages CASCADE;
DROP TABLE IF EXISTS household_members CASCADE;
DROP TABLE IF EXISTS households CASCADE;

-- 1. Households
CREATE TABLE households (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Nuestro hogar',
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{"shared_expenses": true, "shared_goals": true, "shared_budget": true, "chat_enabled": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hh_all" ON households FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- 2. Household members
CREATE TABLE household_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hm_insert" ON household_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "hm_select_own" ON household_members FOR SELECT USING (auth.uid() = user_id);

-- 3. Chat
CREATE TABLE household_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE household_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hmsg_all" ON household_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Activity
CREATE TABLE household_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE household_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ha_all" ON household_activity FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Columnas en transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 6. Realtime (solo si no existen ya)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE household_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE household_activity;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
