SELECT s.segment_id, s.cohort, s.platform, s.region,
       s.conversion_at_risk_usd, s.conversion_drop,
       s.matching_experiment_id AS experiment_id,
       e.description, e.observed_lift
FROM nimbus_serving.open_sliding s
JOIN nimbus_serving.experiments e
  ON e.experiment_id = s.matching_experiment_id
WHERE s.has_matching_experiment = true
  AND e.won = true
ORDER BY s.conversion_at_risk_usd DESC
LIMIT 10;

