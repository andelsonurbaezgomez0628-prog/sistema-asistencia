CREATE TABLE IF NOT EXISTS sesiones (
  session_id VARCHAR(128) PRIMARY KEY,
  expires BIGINT NOT NULL,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones (expires);