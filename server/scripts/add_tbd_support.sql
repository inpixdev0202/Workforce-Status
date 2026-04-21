-- TBD placeholder support for project_assignments
-- Makes employee_id nullable (TBD rows have no employee yet)
-- Adds tbd_employment_type to distinguish 정규직 vs 계약직 TBD slots
ALTER TABLE project_assignments ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS tbd_employment_type VARCHAR(20);
