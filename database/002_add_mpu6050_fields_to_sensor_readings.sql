-- Aplicar una vez después de 001 sobre landsis.
-- NULL significa dato ausente; cero es una medición válida.
ALTER TABLE sensor_readings
    ADD COLUMN accel_x DOUBLE PRECISION,
    ADD COLUMN accel_y DOUBLE PRECISION,
    ADD COLUMN accel_z DOUBLE PRECISION,
    ADD COLUMN gyro_x DOUBLE PRECISION,
    ADD COLUMN gyro_y DOUBLE PRECISION,
    ADD COLUMN gyro_z DOUBLE PRECISION,
    ADD COLUMN temperature DOUBLE PRECISION,
    ADD CONSTRAINT sensor_readings_mpu_complete CHECK (
        (accel_x IS NULL AND accel_y IS NULL AND accel_z IS NULL
         AND gyro_x IS NULL AND gyro_y IS NULL AND gyro_z IS NULL
         AND temperature IS NULL)
        OR
        (accel_x IS NOT NULL AND accel_y IS NOT NULL AND accel_z IS NOT NULL
         AND gyro_x IS NOT NULL AND gyro_y IS NOT NULL AND gyro_z IS NOT NULL
         AND temperature IS NOT NULL)
    );
