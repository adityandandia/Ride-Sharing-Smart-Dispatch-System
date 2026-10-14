USE ridedispatch;
DELIMITER $$

-- Demand-based surge: trips requested in the last 10 minutes vs. available drivers.
CREATE PROCEDURE compute_surge(OUT p_surge DECIMAL(3,2))
BEGIN
  DECLARE v_demand INT DEFAULT 0;
  DECLARE v_supply INT DEFAULT 0;
  DECLARE v_ratio  DECIMAL(8,2);
  SELECT COUNT(*) INTO v_demand FROM trips WHERE requested_at >= NOW() - INTERVAL 10 MINUTE;
  SELECT COUNT(*) INTO v_supply FROM drivers WHERE status = 'Available';
  SET v_ratio = v_demand / GREATEST(v_supply, 1);
  IF v_ratio <= 1 THEN
    SET p_surge = 1.00;
  ELSE
    SET p_surge = LEAST(3.00, ROUND(1 + (v_ratio - 1) * 0.25, 2));
  END IF;
END$$

-- Fare engine. p_surge is INOUT: an admin override (if set) replaces it and the
-- effective multiplier is handed back so it can be stored on the trip.
CREATE PROCEDURE calculate_fare(
  IN    p_dist  DECIMAL(7,2),
  IN    p_time  DECIMAL(7,2),
  INOUT p_surge DECIMAL(3,2),
  OUT   p_fare  DECIMAL(10,2)
)
BEGIN
  DECLARE v_base DECIMAL(8,2);
  DECLARE v_km   DECIMAL(8,2);
  DECLARE v_min  DECIMAL(8,2);
  DECLARE v_floor DECIMAL(8,2);
  DECLARE v_override DECIMAL(3,2);

  SELECT base_fare, per_km, per_min, min_fare, surge_override
    INTO v_base, v_km, v_min, v_floor, v_override
    FROM pricing_config WHERE config_id = 1;

  IF v_override IS NOT NULL THEN
    SET p_surge = v_override;
  END IF;
  IF p_surge IS NULL OR p_surge < 1 THEN
    SET p_surge = 1.00;
  END IF;

  SET p_fare = ROUND(GREATEST(v_floor, (v_base + p_dist * v_km + p_time * v_min) * p_surge), 2);
END$$

DELIMITER ;
