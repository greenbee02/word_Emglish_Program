BEGIN;
CREATE TABLE IF NOT EXISTS public.user_state (
  user_id UUID PRIMARY KEY,
  state JSONB NOT NULL,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.user_state ENABLE ROW LEVEL SECURITY;
-- No browser policies: only the authenticated Render API accesses this table.
-- Its trusted DB connection must own the table (or have BYPASSRLS).
-- Legacy app_state is never changed or assigned to an arbitrary visitor.
COMMIT;
