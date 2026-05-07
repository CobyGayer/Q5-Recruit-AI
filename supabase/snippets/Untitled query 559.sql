

INSERT INTO "public"."programs" ("id", "name", "institution", "domain", "division", "conference", "created_at", "updated_at") VALUES ('615eb817-3cdc-4208-a07a-807faa0f05cd', 'Amherst College Men''s Soccer', 'Amherst College', 'amherst.edu', 'D3', 'NESCAC', '2026-04-27 23:02:37.155681+00', '2026-04-27 23:02:37.155681+00');

INSERT INTO "public"."coaches" ("id", "program_id", "full_name", "email", "role", "status", "api_key", "onboarding_completed", "created_at", "updated_at", "email_pipeline_status") VALUES ('89451e92-1975-414d-85ec-b758fde2a6a4', '615eb817-3cdc-4208-a07a-807faa0f05cd', 'Megan Li', 'megli27@amherst.edu', 'coach', 'approved', null, 'true', '2026-04-27 23:04:26.036752+00', '2026-04-27 23:11:06.590537+00', 'pending_setup');