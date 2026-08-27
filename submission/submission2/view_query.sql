-- Executed by nimbus-growth-desk at 2026-08-27T05:44:36.923Z.
-- $1 = segment id or NULL; $2 = bounded row limit (maximum 40).
WITH ranked_sliding AS (
  SELECT os.*,
         row_number() OVER (ORDER BY os.conversion_at_risk_usd DESC, os.segment_id) AS risk_rank
    FROM nimbus_serving.open_sliding os
), latest_decision AS (
  SELECT DISTINCT ON (segment_id)
         id AS decision_id, segment_id, action_type, target_experiment_id,
         flag_key, variant, rollout_pct, status AS decision_status,
         approved_by, created_at, decided_at
    FROM app.feature_decisions_app
   ORDER BY segment_id, created_at DESC
)
SELECT sp.segment_id, sp.cohort, sp.platform, sp.region, sp.segment_summary,
       sp.mau, sp.conversion_rate, sp.conversion_rate_3w_ago,
       sp.conversion_drop, sp.slide_signal_score, sp.conv_band,
       sp.conversion_at_risk_usd, rs.risk_rank,
       rs.has_matching_experiment, rs.matching_experiment_id,
       rs.matching_experiment_lift, rs.neighbor_flag_key,
       ar.recommended_action, ar.predicted_conversion_lift,
       ar.predicted_net_value_usd, ar.action_ranking, ar.scored_at,
       ld.decision_id, ld.action_type AS decided_action,
       ld.target_experiment_id, ld.flag_key, ld.variant, ld.rollout_pct,
       ld.decision_status, ld.approved_by, ld.created_at AS decision_created_at,
       ld.decided_at
  FROM nimbus_serving.segment_positions sp
  JOIN ranked_sliding rs USING (segment_id)
  LEFT JOIN nimbus_serving.action_recommendations ar USING (segment_id)
  LEFT JOIN latest_decision ld USING (segment_id)
 WHERE ($1::text IS NULL OR sp.segment_id = $1)
 ORDER BY rs.risk_rank
 LIMIT $2;
