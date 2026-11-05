-- Aplicar una sola vez después de 004, con el backend detenido.
BEGIN;
ALTER TABLE users ADD COLUMN credential_version INTEGER NOT NULL DEFAULT 0
    CONSTRAINT users_credential_version_nonnegative CHECK (credential_version >= 0);

-- Una fila por usuario: sustituirla invalida cualquier enlace anterior.
CREATE TABLE password_reset_tokens (
    user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT password_reset_tokens_lifetime CHECK (expires_at = created_at + INTERVAL '15 minutes')
);
CREATE INDEX password_reset_tokens_expires_idx ON password_reset_tokens (expires_at);
COMMIT;
