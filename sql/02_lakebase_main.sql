-- Run against database nimbus on the protected Lakebase main branch.
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.feature_decisions_app (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN
    ('ship_proven_variant', 'rollout_existing_flag', 'ship_alt_variant')),
  target_experiment_id text,
  flag_key text,
  variant text,
  rollout_pct integer CHECK (rollout_pct BETWEEN 0 AND 100),
  drafted_note text,
  predicted_conversion_lift double precision,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN
    ('proposed', 'approved', 'shipped', 'overridden')),
  approved_by text,
  audit_trail jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS feature_decisions_segment_idx
  ON app.feature_decisions_app (segment_id, created_at DESC);

-- Required for complete before/after images in Lakebase CDF.
ALTER TABLE app.feature_decisions_app REPLICA IDENTITY FULL;

