-- RAZ-321: claim verification workflow — structured evidence, reviewer notes,
-- and an "info_required" status so admins can ask for more proof.
ALTER TABLE "profile_claims" ADD COLUMN IF NOT EXISTS "evidence" text DEFAULT '';
ALTER TABLE "profile_claims" ADD COLUMN IF NOT EXISTS "evidence_type" text DEFAULT 'other';
ALTER TABLE "profile_claims" ADD COLUMN IF NOT EXISTS "reviewer_note" text DEFAULT '';
