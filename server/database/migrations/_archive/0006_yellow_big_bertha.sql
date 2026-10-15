ALTER TABLE "dancers" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "dancers" ADD CONSTRAINT "dancers_username_unique" UNIQUE("username");