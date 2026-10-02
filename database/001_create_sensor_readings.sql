-- Ejecutar sobre la base landsis ya creada. No crea ni elimina la base.
CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    node_id TEXT NOT NULL CHECK (length(btrim(node_id)) > 0),
    soil_moisture_raw INTEGER NOT NULL CHECK (soil_moisture_raw BETWEEN 0 AND 4095),
    vibration_detected BOOLEAN NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
