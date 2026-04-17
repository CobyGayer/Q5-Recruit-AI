-- ==========================================
-- Migration: Auto-resolve review groups when membership drops below 2
-- ==========================================
-- When a recruit is deleted, the FK cascade removes their row from
-- recruit_duplicate_review_group_members. Without this trigger, groups
-- that drop to 0 or 1 member remain in pending/dismissed status
-- indefinitely — showing a stale count and a merge button that can never
-- fire. This trigger auto-resolves those groups immediately after the
-- cascade delete completes.

CREATE OR REPLACE FUNCTION public.auto_resolve_underpopulated_review_group()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM public.recruit_duplicate_review_group_members
  WHERE group_id = OLD.group_id;

  IF v_remaining < 2 THEN
    UPDATE public.recruit_duplicate_review_groups
    SET status      = 'resolved',
        resolved_at = now(),
        updated_at  = now()
    WHERE id     = OLD.group_id
      AND status IN ('pending', 'dismissed');
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS auto_resolve_review_group_on_member_delete
  ON public.recruit_duplicate_review_group_members;

CREATE TRIGGER auto_resolve_review_group_on_member_delete
  AFTER DELETE ON public.recruit_duplicate_review_group_members
  FOR EACH ROW EXECUTE FUNCTION public.auto_resolve_underpopulated_review_group();
