-- RAZ-115: opt-in attendee visibility for plan items.
--
-- Adds `share_going` to `plan_items`. When true the dancer appears in the
-- public "who's going" list; when false (default) they are counted but not
-- individually listed. Default false = privacy-conservative: existing rows
-- become hidden until each dancer opts in.
ALTER TABLE "plan_items" ADD COLUMN "share_going" boolean DEFAULT false NOT NULL;
