-- Missing fields request queue
-- Tracks recruits for which the coach needs to request additional profile info.
-- Each recruit can appear at most once (UNIQUE on recruit_id) — the one-time-ask rule.

CREATE TABLE recruit_missing_fields_queue (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id              UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  coach_id                UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  recruit_id              UUID NOT NULL REFERENCES recruits(id) ON DELETE CASCADE,
  -- Snapshot of weight-adjusted missing fields at queue-insertion time (informational only)
  missing_fields_snapshot TEXT[] NOT NULL DEFAULT '{}',
  -- Null = pending. Set when coach triggers an email send.
  info_requested_at       TIMESTAMPTZ NULL,
  -- Null = not dismissed. Set when coach removes entry without sending.
  dismissed_at            TIMESTAMPTZ NULL,
  queued_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One-time rule: each recruit can appear in the queue at most once, ever
CREATE UNIQUE INDEX recruit_missing_fields_queue_recruit_uniq
  ON recruit_missing_fields_queue (recruit_id);

CREATE INDEX recruit_missing_fields_queue_program_id_idx
  ON recruit_missing_fields_queue (program_id);

ALTER TABLE recruit_missing_fields_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches_read_own_program_missing_fields_queue"
  ON recruit_missing_fields_queue FOR SELECT
  USING (
    program_id IN (
      SELECT program_id FROM coaches WHERE id = auth.uid()
    )
  );

CREATE POLICY "coaches_update_own_program_missing_fields_queue"
  ON recruit_missing_fields_queue FOR UPDATE
  USING (
    program_id IN (
      SELECT program_id FROM coaches WHERE id = auth.uid()
    )
  );
