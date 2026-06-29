CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_config_read" ON app_config FOR SELECT USING (true);

INSERT INTO app_config (key, value) VALUES ('latest_build', '1');
INSERT INTO app_config (key, value) VALUES ('latest_build_url', '');
INSERT INTO app_config (key, value) VALUES ('latest_build_notes', '');
