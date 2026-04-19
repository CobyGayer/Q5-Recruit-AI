-- ==========================================
-- Migration: Atomic merge RPC for duplicate recruits
-- ==========================================
-- Provides a server-callable function that merges a set of loser recruits
-- into a designated survivor in a single transaction with row-level locking
-- to prevent concurrent merge collisions.

CREATE OR REPLACE FUNCTION public.merge_duplicate_recruits(
  p_survivor_id    UUID,
  p_loser_ids      UUID[],
  p_survivor_data  JSONB  -- pre-computed merged field payload from TypeScript
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_program_id          UUID;
  v_loser_id            UUID;
  v_best_transcript_id  UUID;
  v_locked_count        INT;
BEGIN
  -- -------------------------------------------------------
  -- 1. Validate inputs before locking anything.
  -- -------------------------------------------------------
  IF p_survivor_id = ANY(p_loser_ids) THEN
    RAISE EXCEPTION 'Survivor % cannot also appear in p_loser_ids', p_survivor_id;
  END IF;

  IF array_length(p_loser_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'p_loser_ids must contain at least one ID';
  END IF;

  -- -------------------------------------------------------
  -- 2. Lock all rows in deterministic order (ascending UUID)
  --    to avoid deadlocks when two concurrent merges overlap.
  -- -------------------------------------------------------
  PERFORM id FROM public.recruits
  WHERE id = ANY(ARRAY[p_survivor_id] || p_loser_ids)
  ORDER BY id
  FOR UPDATE;

  -- -------------------------------------------------------
  -- 3. Validate: survivor exists, all losers exist, same program_id.
  -- -------------------------------------------------------
  SELECT program_id INTO v_program_id
  FROM public.recruits
  WHERE id = p_survivor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Survivor recruit % not found', p_survivor_id;
  END IF;

  -- Assert every requested loser ID actually exists.
  SELECT COUNT(*) INTO v_locked_count
  FROM public.recruits
  WHERE id = ANY(p_loser_ids);

  IF v_locked_count <> array_length(p_loser_ids, 1) THEN
    RAISE EXCEPTION 'One or more loser IDs not found (expected %, found %)',
      array_length(p_loser_ids, 1), v_locked_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.recruits
    WHERE id = ANY(p_loser_ids)
      AND program_id <> v_program_id
  ) THEN
    RAISE EXCEPTION 'All recruits must belong to the same program';
  END IF;

  -- -------------------------------------------------------
  -- 4. Reassign multi-row tables from losers → survivor.
  --    Must happen before deleting losers (FK references).
  -- -------------------------------------------------------
  UPDATE public.ingested_emails
  SET recruit_id = p_survivor_id
  WHERE recruit_id = ANY(p_loser_ids);

  UPDATE public.email_log
  SET recruit_id = p_survivor_id
  WHERE recruit_id = ANY(p_loser_ids);

  -- -------------------------------------------------------
  -- 5. Merge coach_recruit_flags: transfer loser flags to survivor,
  --    keeping the most recent flag on conflict.
  --    The unique constraint is (program_id, recruit_id) meaning
  --    one flag per recruit per program (shared between all coaches).
  -- -------------------------------------------------------
  FOREACH v_loser_id IN ARRAY p_loser_ids LOOP
    INSERT INTO public.coach_recruit_flags (coach_id, program_id, recruit_id, flag, created_at)
    SELECT lf.coach_id, lf.program_id, p_survivor_id, lf.flag, lf.created_at
    FROM public.coach_recruit_flags lf
    WHERE lf.recruit_id = v_loser_id
    ON CONFLICT (program_id, recruit_id)
    DO UPDATE SET
      coach_id   = CASE
                     WHEN EXCLUDED.created_at > coach_recruit_flags.created_at
                     THEN EXCLUDED.coach_id
                     ELSE coach_recruit_flags.coach_id
                   END,
      flag       = CASE
                     WHEN EXCLUDED.created_at > coach_recruit_flags.created_at
                     THEN EXCLUDED.flag
                     ELSE coach_recruit_flags.flag
                   END,
      created_at = GREATEST(EXCLUDED.created_at, coach_recruit_flags.created_at);

    DELETE FROM public.coach_recruit_flags WHERE recruit_id = v_loser_id;
  END LOOP;

  -- -------------------------------------------------------
  -- 6. transcript_analyses: keep the single best analysis
  --    (readable first, then higher confidence, then newer).
  -- -------------------------------------------------------
  SELECT id INTO v_best_transcript_id
  FROM public.transcript_analyses
  WHERE recruit_id = ANY(ARRAY[p_survivor_id] || p_loser_ids)
  ORDER BY
    transcript_readable DESC,
    CASE confidence WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
    analyzed_at DESC
  LIMIT 1;

  IF v_best_transcript_id IS NOT NULL THEN
    -- Delete all analyses for the merge group except the chosen one
    DELETE FROM public.transcript_analyses
    WHERE recruit_id = ANY(ARRAY[p_survivor_id] || p_loser_ids)
      AND id <> v_best_transcript_id;

    -- Point the winner at the survivor
    UPDATE public.transcript_analyses
    SET recruit_id = p_survivor_id
    WHERE id = v_best_transcript_id;
  END IF;

  -- -------------------------------------------------------
  -- 7. recruit_dqs_scores: drop all loser scores.
  --    TypeScript caller recomputes the survivor's DQS after returning.
  -- -------------------------------------------------------
  DELETE FROM public.recruit_dqs_scores
  WHERE recruit_id = ANY(p_loser_ids);

  -- -------------------------------------------------------
  -- 8. Delete loser rows BEFORE updating survivor.
  --    Losers may share email/program with survivor; deleting first
  --    avoids a unique constraint violation on idx_recruits_program_email_unique
  --    when the survivor UPDATE adopts a loser's email.
  -- -------------------------------------------------------
  DELETE FROM public.recruits WHERE id = ANY(p_loser_ids);

  -- -------------------------------------------------------
  -- 9. Apply the pre-computed merged field payload to the survivor.
  --    COALESCE is intentionally defensive: the TS merge logic never
  --    nulls a field (it skips null values), so COALESCE aligns with
  --    that contract. If a future caller wants to explicitly clear a
  --    field, this SQL must be updated to use direct assignment instead.
  -- -------------------------------------------------------
  UPDATE public.recruits
  SET
    email                = COALESCE((p_survivor_data->>'email'), email),
    full_name            = COALESCE((p_survivor_data->>'full_name'), full_name),
    phone                = COALESCE((p_survivor_data->>'phone'), phone),
    graduation_year      = COALESCE((p_survivor_data->>'graduation_year')::INT, graduation_year),
    current_school       = COALESCE((p_survivor_data->>'current_school'), current_school),
    city                 = COALESCE((p_survivor_data->>'city'), city),
    state                = COALESCE((p_survivor_data->>'state'), state),
    country              = COALESCE((p_survivor_data->>'country'), country),
    preferred_foot       = COALESCE((p_survivor_data->>'preferred_foot'), preferred_foot),
    height_inches        = COALESCE((p_survivor_data->>'height_inches')::INT, height_inches),
    weight_lbs           = COALESCE((p_survivor_data->>'weight_lbs')::INT, weight_lbs),
    gpa                  = COALESCE((p_survivor_data->>'gpa')::NUMERIC, gpa),
    sat_score            = COALESCE((p_survivor_data->>'sat_score')::INT, sat_score),
    act_score            = COALESCE((p_survivor_data->>'act_score')::INT, act_score),
    club_team            = COALESCE((p_survivor_data->>'club_team'), club_team),
    club_level           = COALESCE((p_survivor_data->>'club_level')::club_level, club_level),
    high_school_team     = COALESCE((p_survivor_data->>'high_school_team'), high_school_team),
    video_url            = COALESCE((p_survivor_data->>'video_url'), video_url),
    extraction_confidence = COALESCE(p_survivor_data->'extraction_confidence', extraction_confidence),
    fields_missing       = COALESCE(
                             ARRAY(SELECT jsonb_array_elements_text(p_survivor_data->'fields_missing')),
                             fields_missing
                           ),
    fields_extracted     = COALESCE((p_survivor_data->>'fields_extracted')::INT, fields_extracted),
    fields_total         = COALESCE((p_survivor_data->>'fields_total')::INT, fields_total),
    updated_at           = now()
  WHERE id = p_survivor_id;

  -- Handle positions (union of survivor's existing positions + merged ones)
  IF p_survivor_data ? 'positions' THEN
    UPDATE public.recruits
    SET positions = ARRAY(
      SELECT DISTINCT unnest(
        positions ||
        ARRAY(SELECT jsonb_array_elements_text(p_survivor_data->'positions'))
      )
    )
    WHERE id = p_survivor_id;
  END IF;

  -- -------------------------------------------------------
  -- 10. Remove the merged losers from review group members.
  --    Auto-resolve any group that now has fewer than 2 members.
  -- -------------------------------------------------------
  DELETE FROM public.recruit_duplicate_review_group_members
  WHERE recruit_id = ANY(p_loser_ids);

  UPDATE public.recruit_duplicate_review_groups g
  SET
    status      = CASE
                    WHEN member_count < 2 THEN 'resolved'
                    WHEN g.status = 'dismissed' THEN 'dismissed'
                    ELSE 'pending'
                  END,
    resolved_at = CASE WHEN member_count < 2 THEN now() ELSE NULL END,
    updated_at  = now()
  FROM (
    SELECT m.group_id, count(*) AS member_count
    FROM public.recruit_duplicate_review_group_members m
    WHERE m.group_id IN (
      SELECT DISTINCT group_id
      FROM public.recruit_duplicate_review_group_members
      WHERE recruit_id = p_survivor_id
    )
    GROUP BY m.group_id
  ) counts
  WHERE g.id = counts.group_id;

END;
$$;

-- Restrict execution to service_role only (SECURITY DEFINER function must not be public-callable).
REVOKE EXECUTE ON FUNCTION public.merge_duplicate_recruits(UUID, UUID[], JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.merge_duplicate_recruits(UUID, UUID[], JSONB) TO service_role;
