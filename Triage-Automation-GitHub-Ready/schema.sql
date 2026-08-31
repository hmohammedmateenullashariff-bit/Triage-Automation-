-- Workflow automation engine schema for Supabase (Postgres)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE workflows (
    workflow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    trigger JSONB NOT NULL,
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    webhook_token TEXT UNIQUE,
    encrypted_webhook_secret TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflows_webhook_token ON workflows (webhook_token);

CREATE TABLE execution_runs (
    run_id PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_execution_runs_workflow_id ON execution_runs (workflow_id);

CREATE TABLE node_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES execution_runs(run_id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
    output JSONB,
    error TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX idx_node_execution_logs_run_id ON node_execution_logs (run_id);

-- Credential store: secrets are encrypted at the application layer (Fernet)
-- before being written to encrypted_value.  The column stores ciphertext only.
CREATE TABLE credentials (
    credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('api_key', 'bearer_token', 'basic_auth', 'custom_header')),
    encrypted_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
