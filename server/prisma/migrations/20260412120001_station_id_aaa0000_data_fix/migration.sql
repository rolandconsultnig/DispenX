-- Align legacy seed station codes with attendant portal format (3 letters + 4 digits).
UPDATE "stations" SET "station_code" = 'LEK0001' WHERE "station_code" = 'LEK-01';
UPDATE "stations" SET "station_code" = 'IKY0001' WHERE "station_code" = 'IKY-01';
