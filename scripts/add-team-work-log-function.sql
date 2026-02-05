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
