-- Persist per-game MP4 highlights extracted from game JSON.
-- This replaces dependence on recap/upcoming feed posts for clip rendering.

CREATE TABLE IF NOT EXISTS public.game_highlight_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  game_date date NULL,
  event_num integer NULL,
  action_id integer NULL,
  period integer NULL,
  clock text NULL,
  description text NULL,
  action_type text NULL,
  sub_type text NULL,
  team_id integer NULL,
  team_tricode text NULL,
  person_id integer NULL,
  player_name text NULL,
  score_home text NULL,
  score_away text NULL,
  mp4_url text NOT NULL,
  source_bucket text NULL,
  source_path text NULL,
  source_checksum text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_highlight_clips_game_action_unique UNIQUE (game_id, action_id, mp4_url)
);

CREATE INDEX IF NOT EXISTS idx_game_highlight_clips_game_id
  ON public.game_highlight_clips (game_id);

CREATE INDEX IF NOT EXISTS idx_game_highlight_clips_game_period_event
  ON public.game_highlight_clips (game_id, period, event_num);

CREATE INDEX IF NOT EXISTS idx_game_highlight_clips_game_date
  ON public.game_highlight_clips (game_date DESC);

-- Track ingest/deletion results for observability and idempotent backfills.
CREATE TABLE IF NOT EXISTS public.game_highlight_ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  source_bucket text NOT NULL,
  source_path text NOT NULL,
  source_checksum text NULL,
  clips_extracted integer NOT NULL DEFAULT 0,
  clips_upserted integer NOT NULL DEFAULT 0,
  deleted_source boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'started',
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_game_highlight_ingest_runs_game
  ON public.game_highlight_ingest_runs (game_id, created_at DESC);

ALTER TABLE public.game_highlight_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_highlight_ingest_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read game highlight clips" ON public.game_highlight_clips;
CREATE POLICY "Anyone can read game highlight clips"
  ON public.game_highlight_clips
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages game highlight clips" ON public.game_highlight_clips;
CREATE POLICY "Service role manages game highlight clips"
  ON public.game_highlight_clips
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can read ingest runs" ON public.game_highlight_ingest_runs;
CREATE POLICY "Admins can read ingest runs"
  ON public.game_highlight_ingest_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role manages ingest runs" ON public.game_highlight_ingest_runs;
CREATE POLICY "Service role manages ingest runs"
  ON public.game_highlight_ingest_runs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.update_game_highlight_clips_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_game_highlight_clips_updated_at ON public.game_highlight_clips;
CREATE TRIGGER trg_update_game_highlight_clips_updated_at
  BEFORE UPDATE ON public.game_highlight_clips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_game_highlight_clips_updated_at();
