ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS missing_fields_email_subject TEXT NULL,
  ADD COLUMN IF NOT EXISTS missing_fields_email_body    TEXT NULL;

DO $$ BEGIN
  ALTER TABLE public.coaches
    ADD CONSTRAINT coaches_missing_fields_email_subject_length
      CHECK (missing_fields_email_subject IS NULL OR char_length(missing_fields_email_subject) <= 300);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.coaches
    ADD CONSTRAINT coaches_missing_fields_email_body_length
      CHECK (missing_fields_email_body IS NULL OR char_length(missing_fields_email_body) <= 5000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
