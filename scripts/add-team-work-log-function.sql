-- Run this SQL in Supabase SQL Editor to enable team work log creation
-- This function allows creating work logs for all assigned users when a street is completed

CREATE OR REPLACE FUNCTION create_team_work_logs(
  p_street_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_user_ids UUID[],
  p_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Loop through all user IDs and create work logs
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    -- Insert work log for each user (skip if already exists for this user/street/date)
    INSERT INTO work_logs (user_id, street_id, date, start_time, end_time, notes)
    VALUES (v_user_id, p_street_id, p_date, p_start_time, p_end_time, p_notes)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_team_work_logs TO authenticated;

-- Function to sync street status after work log deletion
-- This uses SECURITY DEFINER to bypass RLS and see all work logs
CREATE OR REPLACE FUNCTION sync_street_status_after_delete(
  p_street_id UUID,
  p_date DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_user_ids UUID[];
  v_status_id UUID;
  v_current_assigned UUID[];
BEGIN
  -- Get all remaining work log user IDs for this street/date (bypasses RLS)
  SELECT ARRAY_AGG(DISTINCT user_id) INTO v_remaining_user_ids
  FROM work_logs
  WHERE street_id = p_street_id AND date = p_date;

  -- Get current street status
  SELECT id, assigned_users INTO v_status_id, v_current_assigned
  FROM daily_street_status
  WHERE street_id = p_street_id AND date = p_date;

  IF v_status_id IS NULL THEN
    RETURN;
  END IF;

  IF v_remaining_user_ids IS NULL OR array_length(v_remaining_user_ids, 1) IS NULL THEN
    -- No remaining logs - reset to "offen" and delete all history entries
    UPDATE daily_street_status
    SET status = 'offen',
        assigned_users = '{}',
        started_at = NULL,
        finished_at = NULL,
        current_round = 1
    WHERE id = v_status_id;

    -- Delete all street_status_entries for this street/date
    DELETE FROM street_status_entries
    WHERE street_id = p_street_id AND date = p_date;
  ELSE
    -- Update assigned_users to only include users with remaining logs
    UPDATE daily_street_status
    SET assigned_users = v_remaining_user_ids
    WHERE id = v_status_id;

    -- Update street_status_entries assigned_users as well
    UPDATE street_status_entries
    SET assigned_users = (
      SELECT ARRAY_AGG(uid)
      FROM unnest(assigned_users) AS uid
      WHERE uid = ANY(v_remaining_user_ids)
    )
    WHERE street_id = p_street_id AND date = p_date;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sync_street_status_after_delete TO authenticated;
