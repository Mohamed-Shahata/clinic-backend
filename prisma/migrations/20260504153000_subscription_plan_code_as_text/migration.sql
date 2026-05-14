-- Allow arbitrary subscription plan codes (multiple plans / durations)
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "code" DROP DEFAULT;
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "code" TYPE TEXT USING "code"::text;
