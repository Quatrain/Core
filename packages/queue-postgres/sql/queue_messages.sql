-- Durable task queue for @quatrain/queue-postgres.
-- Idempotent: safe to run at every start.

CREATE TABLE IF NOT EXISTS queue_messages (
   id UUID PRIMARY KEY,
   topic TEXT NOT NULL,
   status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
   payload JSONB NOT NULL,
   progress INTEGER NOT NULL DEFAULT 0,
   attempts INTEGER NOT NULL DEFAULT 0,
   error TEXT,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   started_at TIMESTAMPTZ,
   completed_at TIMESTAMPTZ
);

-- Claiming the oldest pending task of a topic.
CREATE INDEX IF NOT EXISTS queue_messages_pending_idx
   ON queue_messages (topic, created_at, id)
   WHERE status = 'pending';

-- Finding tasks left in processing by a worker that stopped.
CREATE INDEX IF NOT EXISTS queue_messages_processing_idx
   ON queue_messages (started_at)
   WHERE status = 'processing';
