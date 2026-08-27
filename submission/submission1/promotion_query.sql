-- Replayed after the Git merge on Lakebase main:
\i migrations/001_decision_forecasts.sql

SELECT segment_id, forecast_conversion_lift,
       forecast_conversion_at_risk_usd, rationale
FROM app.decision_forecasts
WHERE segment_id = 'SEG-0000214';

