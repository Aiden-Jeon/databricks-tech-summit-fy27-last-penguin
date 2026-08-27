-- Author: OpenAI Codex
-- Nimbus Build 1 development-branch migration.
CREATE TABLE IF NOT EXISTS app.decision_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_decision_id uuid REFERENCES app.feature_decisions_app(id) ON DELETE CASCADE,
  segment_id text NOT NULL,
  forecast_conversion_lift double precision NOT NULL,
  forecast_conversion_at_risk_usd double precision NOT NULL,
  rationale text NOT NULL,
  forecasted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decision_forecasts_segment_idx
  ON app.decision_forecasts (segment_id, forecasted_at DESC);

ALTER TABLE app.decision_forecasts REPLICA IDENTITY FULL;

INSERT INTO app.decision_forecasts (
  feature_decision_id,
  segment_id,
  forecast_conversion_lift,
  forecast_conversion_at_risk_usd,
  rationale
)
SELECT NULL, 'SEG-0000214', 0.0225, 524160.00,
       'Proven checkout variant EXP-0000009 for Gen-Z Android users.'
WHERE NOT EXISTS (
  SELECT 1 FROM app.decision_forecasts WHERE segment_id = 'SEG-0000214'
);
