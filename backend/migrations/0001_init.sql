-- +goose Up
CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'ALCHEMIST',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materials (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS missions (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transmutations (
  id BIGSERIAL PRIMARY KEY,
  mission_id BIGINT REFERENCES missions(id) ON DELETE SET NULL,
  requested_by BIGINT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'queued',
  cost NUMERIC(12,2),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audits (
  id BIGSERIAL PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id BIGINT,
  action TEXT NOT NULL,
  actor_id BIGINT REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_transmutations_status ON transmutations(status);
CREATE INDEX IF NOT EXISTS idx_audits_entity ON audits(entity, entity_id);

-- +goose Down
DROP TABLE IF EXISTS audits;
DROP TABLE IF EXISTS transmutations;
DROP TABLE IF EXISTS missions;
DROP TABLE IF EXISTS materials;
DROP TABLE IF EXISTS users;
