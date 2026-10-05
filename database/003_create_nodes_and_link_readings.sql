-- Aplicar una vez después de 001 y 002, con recepción detenida.
BEGIN;
LOCK TABLE sensor_readings IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE nodes (
    node_id TEXT PRIMARY KEY CHECK (length(btrim(node_id)) > 0)
);

-- Preservar literalmente cada identidad histórica.
INSERT INTO nodes (node_id)
SELECT DISTINCT node_id FROM sensor_readings;

INSERT INTO nodes (node_id) VALUES ('LADERA-1') ON CONFLICT DO NOTHING;

ALTER TABLE sensor_readings
    ADD CONSTRAINT sensor_readings_node_fk
    FOREIGN KEY (node_id) REFERENCES nodes (node_id);

CREATE INDEX sensor_readings_node_received_idx
    ON sensor_readings (node_id, received_at DESC, id DESC);
COMMIT;
