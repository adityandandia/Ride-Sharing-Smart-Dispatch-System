USE ridedispatch;
-- All demo accounts use the password: password123
SET @pw = '$2a$10$5e6NlV6sKTE8dV2mkG7rQeAVTkZk2PdB4SWPE82fT7sdlRkW6xZl2';

INSERT INTO pricing_config VALUES (1, 40.00, 12.00, 1.50, 60.00, NULL);

INSERT INTO users (user_id, name, email, phone, password_hash, role) VALUES
 (1,'Admin User','admin@ride.test','9000000001',@pw,'Admin'),
 (2,'Aarav Rider','rider1@ride.test','9000000002',@pw,'Rider'),
 (3,'Diya Rider','rider2@ride.test','9000000003',@pw,'Rider'),
 (4,'Kabir Rider','rider3@ride.test','9000000004',@pw,'Rider'),
 (10,'Ravi Kumar','driver1@ride.test','9100000001',@pw,'Driver'),
 (11,'Suresh Gowda','driver2@ride.test','9100000002',@pw,'Driver'),
 (12,'Manjunath S','driver3@ride.test','9100000003',@pw,'Driver'),
 (13,'Imran Khan','driver4@ride.test','9100000004',@pw,'Driver'),
 (14,'Lakshmi Devi','driver5@ride.test','9100000005',@pw,'Driver'),
 (15,'Prakash Rao','driver6@ride.test','9100000006',@pw,'Driver'),
 (16,'Anil Naik','driver7@ride.test','9100000007',@pw,'Driver'),
 (17,'Joseph D''Souza','driver8@ride.test','9100000008',@pw,'Driver');

INSERT INTO riders (rider_id, preferred_payment) VALUES (2,'UPI'),(3,'Card'),(4,'Cash');

-- POINT(longitude, latitude), Bengaluru neighbourhoods
INSERT INTO drivers (driver_id, license_no, status, current_location) VALUES
 (10,'KA01-2019-0001','Available', POINT(77.6245,12.9352)),  -- Koramangala
 (11,'KA01-2018-0002','Available', POINT(77.6412,12.9719)),  -- Indiranagar
 (12,'KA03-2020-0003','Available', POINT(77.6068,12.9756)),  -- MG Road
 (13,'KA05-2017-0004','Available', POINT(77.5838,12.9308)),  -- Jayanagar
 (14,'KA02-2021-0005','Available', POINT(77.6389,12.9116)),  -- HSR Layout
 (15,'KA04-2016-0006','Available', POINT(77.5970,13.0358)),  -- Hebbal
 (16,'KA51-2019-0007','Offline',   POINT(77.6602,12.8452)),  -- Electronic City
 (17,'KA53-2022-0008','Available', POINT(77.7500,12.9698));  -- Whitefield

INSERT INTO vehicles (driver_id, plate_no, model, vehicle_type, seats) VALUES
 (10,'KA01AB1001','Maruti Swift Dzire','Sedan',4),
 (11,'KA01AB1002','Hyundai i10','Mini',4),
 (12,'KA03CD2003','Toyota Innova','SUV',6),
 (13,'KA05EF3004','Bajaj RE Auto','Auto',3),
 (14,'KA02GH4005','Tata Tiago','Mini',4),
 (15,'KA04JK5006','Honda Amaze','Sedan',4),
 (16,'KA51LM6007','Maruti Ertiga','SUV',6),
 (17,'KA53NP7008','Hyundai Aura','Sedan',4);

-- Completed history (inserted directly as Completed so the 'Busy' trigger does not fire)
INSERT INTO trips (trip_id, rider_id, driver_id, vehicle_id, pickup_location, dropoff_location,
                   pickup_address, dropoff_address, status, distance_km, duration_min,
                   surge_multiplier, fare, requested_at, started_at, completed_at) VALUES
 (1,2,10,1,POINT(77.6245,12.9352),POINT(77.6412,12.9719),'Koramangala','Indiranagar','Completed',6.20,22.00,1.00,147.40,NOW()-INTERVAL 3 DAY,NOW()-INTERVAL 3 DAY,NOW()-INTERVAL 3 DAY),
 (2,3,11,2,POINT(77.6412,12.9719),POINT(77.6068,12.9756),'Indiranagar','MG Road','Completed',4.80,18.00,1.00,124.60,NOW()-INTERVAL 2 DAY,NOW()-INTERVAL 2 DAY,NOW()-INTERVAL 2 DAY),
 (3,2,12,3,POINT(77.6068,12.9756),POINT(77.5838,12.9308),'MG Road','Jayanagar','Completed',7.10,28.00,1.25,226.69,NOW()-INTERVAL 1 DAY,NOW()-INTERVAL 1 DAY,NOW()-INTERVAL 1 DAY),
 (4,4,10,1,POINT(77.6389,12.9116),POINT(77.6245,12.9352),'HSR Layout','Koramangala','Completed',5.00,20.00,1.00,130.00,NOW()-INTERVAL 20 HOUR,NOW()-INTERVAL 20 HOUR,NOW()-INTERVAL 20 HOUR),
 (5,3,13,4,POINT(77.5838,12.9308),POINT(77.5970,13.0358),'Jayanagar','Hebbal','Completed',13.50,45.00,1.00,269.50,NOW()-INTERVAL 5 HOUR,NOW()-INTERVAL 5 HOUR,NOW()-INTERVAL 5 HOUR);

INSERT INTO payments (trip_id, amount, method, status, paid_at) VALUES
 (1,147.40,'UPI','Paid',NOW()-INTERVAL 3 DAY),
 (2,124.60,'Card','Paid',NOW()-INTERVAL 2 DAY),
 (3,226.69,'UPI','Paid',NOW()-INTERVAL 1 DAY),
 (4,130.00,'Cash','Paid',NOW()-INTERVAL 20 HOUR),
 (5,269.50,'Card','Paid',NOW()-INTERVAL 5 HOUR);

-- These inserts fire trg_reviews_after_insert and recalculate driver ratings
INSERT INTO reviews (trip_id, rider_id, rating, comment) VALUES
 (1,2,5,'Smooth ride, polite driver.'),
 (2,3,4,'Good, slightly late pickup.'),
 (3,2,3,'Driver took a longer route than the map showed.'),
 (4,4,5,'Quick and clean car.');

INSERT INTO complaints (trip_id, rider_id, description) VALUES
 (3,2,'The driver took a much longer route than necessary and the fare was higher than the estimate shown in the app.'),
 (2,3,'Driver arrived 15 minutes late and was rude when I asked about the delay.'),
 (5,3,'I was charged surge pricing even though there was no rush hour demand. Please refund the extra amount.');
