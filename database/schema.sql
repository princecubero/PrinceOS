BEGIN;
-- Rename existing columns without losing their historical values.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'module_records'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = t AND column_name = 'created_at') THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN created_at TO addtime', t);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = t AND column_name = 'updated_at') THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN updated_at TO updatetime', t);
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  addtime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  username TEXT UNIQUE,
  password_salt TEXT,
  password_hash TEXT
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

CREATE TABLE IF NOT EXISTS module_records (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN ('events', 'transactions', 'tasks', 'habits', 'goals', 'fitness', 'notes')),
  record_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  addtime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, module, record_id)
);
-- The finance model now treats previous income entries as savings and uses optional notes.
UPDATE module_records
SET payload = (payload - 'category')
  || CASE WHEN payload->>'type' = 'income' THEN '{"type":"savings"}'::jsonb ELSE '{}'::jsonb END
  || CASE WHEN NOT payload ? 'notes' AND payload ? 'category' THEN jsonb_build_object('notes', payload->>'category') ELSE '{}'::jsonb END
WHERE module = 'transactions'
  AND (payload->>'type' = 'income' OR payload ? 'category');
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  addtime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatetime TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

-- Older records never stored creation time; retain their last-known timestamp.
ALTER TABLE module_records ADD COLUMN IF NOT EXISTS addtime TIMESTAMPTZ;
UPDATE module_records SET addtime = updatetime WHERE addtime IS NULL;
ALTER TABLE module_records ALTER COLUMN addtime SET DEFAULT NOW();
ALTER TABLE module_records ALTER COLUMN addtime SET NOT NULL;

CREATE OR REPLACE FUNCTION preserve_record_times() RETURNS TRIGGER AS $$
BEGIN
  NEW.addtime := OLD.addtime;
  IF (to_jsonb(NEW) - 'addtime' - 'updatetime') IS DISTINCT FROM (to_jsonb(OLD) - 'addtime' - 'updatetime') THEN
    NEW.updatetime := clock_timestamp();
  ELSE
    NEW.updatetime := OLD.updatetime;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS users_record_times ON users;
CREATE TRIGGER users_record_times BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION preserve_record_times();
DROP TRIGGER IF EXISTS sessions_record_times ON sessions;
CREATE TRIGGER sessions_record_times BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION preserve_record_times();
DROP TRIGGER IF EXISTS module_record_times ON module_records;
CREATE TRIGGER module_record_times BEFORE UPDATE ON module_records FOR EACH ROW EXECUTE FUNCTION preserve_record_times();
CREATE INDEX IF NOT EXISTS module_records_user_module_idx ON module_records (user_id, module, updatetime DESC);
COMMIT;
