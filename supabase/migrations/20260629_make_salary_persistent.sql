-- Make salary entries persistent (not tied to specific month)
-- First, update unique constraint
ALTER TABLE salary_entries DROP CONSTRAINT IF EXISTS salary_entries_user_id_job_name_month_year_key;

-- Add new unique constraint without month/year
ALTER TABLE salary_entries ADD CONSTRAINT salary_entries_user_id_job_name_key UNIQUE (user_id, job_name);

-- Optional: drop month and year columns if they exist
-- ALTER TABLE salary_entries DROP COLUMN IF EXISTS month;
-- ALTER TABLE salary_entries DROP COLUMN IF EXISTS year;
