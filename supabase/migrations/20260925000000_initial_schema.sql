BEGIN;

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  addtime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  username TEXT UNIQUE,
  password_salt TEXT,
  password_hash TEXT
);

CREATE TABLE IF NOT EXISTS public.module_records (
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN ('events', 'transactions', 'tasks', 'habits', 'goals', 'fitness', 'notes')),
  record_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  addtime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, module, record_id)
);

CREATE TABLE IF NOT EXISTS public.sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  addtime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatetime TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON public.sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON public.sessions (expires_at);
CREATE INDEX IF NOT EXISTS module_records_user_module_idx ON public.module_records (user_id, module, updatetime DESC);

CREATE OR REPLACE FUNCTION public.preserve_record_times() RETURNS TRIGGER AS $$
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

DROP TRIGGER IF EXISTS users_record_times ON public.users;
CREATE TRIGGER users_record_times BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.preserve_record_times();
DROP TRIGGER IF EXISTS sessions_record_times ON public.sessions;
CREATE TRIGGER sessions_record_times BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.preserve_record_times();
DROP TRIGGER IF EXISTS module_record_times ON public.module_records;
CREATE TRIGGER module_record_times BEFORE UPDATE ON public.module_records FOR EACH ROW EXECUTE FUNCTION public.preserve_record_times();

INSERT INTO public.users (id, display_name)
VALUES ('local-user', 'PrinceOS User')
ON CONFLICT (id) DO NOTHING;

COMMIT;
