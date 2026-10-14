USE ridedispatch;
DELIMITER $$

-- A newly matched trip marks its driver Busy
CREATE TRIGGER trg_trips_after_insert
AFTER INSERT ON trips
FOR EACH ROW
BEGIN
  IF NEW.driver_id IS NOT NULL AND NEW.status IN ('Matched','InProgress') THEN
    UPDATE drivers SET status = 'Busy' WHERE driver_id = NEW.driver_id;
  END IF;
END$$

-- Finishing or cancelling a trip frees the driver again
CREATE TRIGGER trg_trips_after_update
AFTER UPDATE ON trips
FOR EACH ROW
BEGIN
  IF NEW.driver_id IS NOT NULL
     AND NEW.status IN ('Completed','Cancelled')
     AND OLD.status IN ('Matched','InProgress') THEN
    UPDATE drivers SET status = 'Available' WHERE driver_id = NEW.driver_id;
  END IF;
END$$

-- A new review recalculates the driver's rating
CREATE TRIGGER trg_reviews_after_insert
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
  DECLARE v_driver INT;
  SELECT driver_id INTO v_driver FROM trips WHERE trip_id = NEW.trip_id;
  IF v_driver IS NOT NULL THEN
    UPDATE drivers
       SET rating_avg = (SELECT ROUND(AVG(r.rating), 2)
                           FROM reviews r JOIN trips t ON t.trip_id = r.trip_id
                          WHERE t.driver_id = v_driver),
           rating_count = (SELECT COUNT(*)
                             FROM reviews r JOIN trips t ON t.trip_id = r.trip_id
                            WHERE t.driver_id = v_driver)
     WHERE driver_id = v_driver;
  END IF;
END$$

DELIMITER ;
