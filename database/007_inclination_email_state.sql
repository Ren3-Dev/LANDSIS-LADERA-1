-- Estado de avisos; no altera usuarios ni mediciones. Aplicar una sola vez.
BEGIN;
CREATE TABLE inclination_email_state (
    node_id TEXT PRIMARY KEY REFERENCES nodes(node_id),
    last_reading_id INTEGER REFERENCES sensor_readings(id),
    critical_active BOOLEAN NOT NULL DEFAULT false,
    last_event_reading_id INTEGER REFERENCES sensor_readings(id),
    delivery_status TEXT NOT NULL DEFAULT 'idle'
        CHECK (delivery_status IN ('idle','pending','sent','partial','failed','no_recipients')),
    accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
    failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
