-- Ride-Sharing & Smart Dispatch System : core schema (3NF)
-- Spatial columns use SRID 0 with POINT(longitude, latitude); ST_Distance_Sphere()
-- interprets x as longitude and y as latitude and returns metres.
CREATE DATABASE IF NOT EXISTS ridedispatch;
USE ridedispatch;

CREATE TABLE users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  phone         VARCHAR(20),
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('Rider','Driver','Admin') NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE riders (
  rider_id          INT PRIMARY KEY,
  preferred_payment ENUM('Cash','Card','UPI') NOT NULL DEFAULT 'UPI',
  CONSTRAINT fk_rider_user FOREIGN KEY (rider_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE drivers (
  driver_id           INT PRIMARY KEY,
  license_no          VARCHAR(30) NOT NULL UNIQUE,
  status              ENUM('Available','Busy','Offline') NOT NULL DEFAULT 'Offline',
  rating_avg          DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  rating_count        INT NOT NULL DEFAULT 0,
  current_location    POINT NOT NULL SRID 0,
  location_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_driver_rating CHECK (rating_avg BETWEEN 0 AND 5),
  CONSTRAINT chk_driver_count  CHECK (rating_count >= 0),
  CONSTRAINT fk_driver_user FOREIGN KEY (driver_id) REFERENCES users(user_id) ON DELETE CASCADE,
  SPATIAL INDEX sp_driver_location (current_location),
  INDEX idx_driver_status (status)
) ENGINE=InnoDB;

CREATE TABLE vehicles (
  vehicle_id   INT AUTO_INCREMENT PRIMARY KEY,
  driver_id    INT NOT NULL,
  plate_no     VARCHAR(20) NOT NULL UNIQUE,
  model        VARCHAR(60) NOT NULL,
  vehicle_type ENUM('Auto','Mini','Sedan','SUV') NOT NULL,
  seats        TINYINT NOT NULL DEFAULT 4,
  CONSTRAINT chk_seats CHECK (seats BETWEEN 1 AND 8),
  CONSTRAINT fk_vehicle_driver FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Single-row pricing table edited by the Admin
CREATE TABLE pricing_config (
  config_id      TINYINT PRIMARY KEY,
  base_fare      DECIMAL(8,2) NOT NULL,
  per_km         DECIMAL(8,2) NOT NULL,
  per_min        DECIMAL(8,2) NOT NULL,
  min_fare       DECIMAL(8,2) NOT NULL,
  surge_override DECIMAL(3,2) NULL,          -- NULL = automatic demand-based surge
  CONSTRAINT chk_cfg_single CHECK (config_id = 1),
  CONSTRAINT chk_cfg_pos    CHECK (base_fare >= 0 AND per_km >= 0 AND per_min >= 0 AND min_fare >= 0),
  CONSTRAINT chk_cfg_surge  CHECK (surge_override IS NULL OR surge_override BETWEEN 1.00 AND 5.00)
) ENGINE=InnoDB;

CREATE TABLE trips (
  trip_id          INT AUTO_INCREMENT PRIMARY KEY,
  rider_id         INT NOT NULL,
  driver_id        INT NULL,
  vehicle_id       INT NULL,
  pickup_location  POINT NOT NULL SRID 0,
  dropoff_location POINT NOT NULL SRID 0,
  pickup_address   VARCHAR(200),
  dropoff_address  VARCHAR(200),
  status           ENUM('Matched','InProgress','Completed','Cancelled') NOT NULL DEFAULT 'Matched',
  distance_km      DECIMAL(7,2) NOT NULL,
  duration_min     DECIMAL(7,2) NOT NULL,
  surge_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  fare             DECIMAL(10,2) NOT NULL,     -- price snapshot at booking time (history must not change when pricing changes)
  requested_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at       TIMESTAMP NULL,
  completed_at     TIMESTAMP NULL,
  CONSTRAINT chk_trip_dist  CHECK (distance_km > 0),
  CONSTRAINT chk_trip_dur   CHECK (duration_min > 0),
  CONSTRAINT chk_trip_surge CHECK (surge_multiplier BETWEEN 1.00 AND 5.00),
  CONSTRAINT chk_trip_fare  CHECK (fare >= 0),
  CONSTRAINT fk_trip_rider   FOREIGN KEY (rider_id)   REFERENCES riders(rider_id),
  CONSTRAINT fk_trip_driver  FOREIGN KEY (driver_id)  REFERENCES drivers(driver_id),
  CONSTRAINT fk_trip_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
  INDEX idx_trip_rider (rider_id, status),
  INDEX idx_trip_driver (driver_id, status),
  INDEX idx_trip_requested (requested_at)
) ENGINE=InnoDB;

CREATE TABLE payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id    INT NOT NULL UNIQUE,
  amount     DECIMAL(10,2) NOT NULL,
  method     ENUM('Cash','Card','UPI') NOT NULL,
  status     ENUM('Pending','Paid','Failed','Refunded') NOT NULL DEFAULT 'Pending',
  paid_at    TIMESTAMP NULL,
  CONSTRAINT chk_pay_amount CHECK (amount >= 0),
  CONSTRAINT fk_pay_trip FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE reviews (
  review_id  INT AUTO_INCREMENT PRIMARY KEY,
  trip_id    INT NOT NULL UNIQUE,              -- one review per trip; driver is derived through trips (3NF)
  rider_id   INT NOT NULL,
  rating     TINYINT NOT NULL,
  comment    VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_review_trip  FOREIGN KEY (trip_id)  REFERENCES trips(trip_id) ON DELETE CASCADE,
  CONSTRAINT fk_review_rider FOREIGN KEY (rider_id) REFERENCES riders(rider_id)
) ENGINE=InnoDB;

CREATE TABLE complaints (
  complaint_id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id      INT NOT NULL,
  rider_id     INT NOT NULL,
  description  TEXT NOT NULL,
  status       ENUM('Open','Resolved') NOT NULL DEFAULT 'Open',
  resolution   TEXT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_complaint_trip  FOREIGN KEY (trip_id)  REFERENCES trips(trip_id) ON DELETE CASCADE,
  CONSTRAINT fk_complaint_rider FOREIGN KEY (rider_id) REFERENCES riders(rider_id)
) ENGINE=InnoDB;
