-- Staff roles are provider-scoped (OWNER, MANAGER, FRONT_DESK, ACCOUNTANT),
-- not the global User Role enum. Convert membership/invite columns to TEXT.

ALTER TABLE "ProviderMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "ProviderMember" ALTER COLUMN "role" TYPE TEXT USING "role"::text;

ALTER TABLE "StaffInvite" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "StaffInvite" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
ALTER TABLE "StaffInvite" ALTER COLUMN "role" SET DEFAULT 'FRONT_DESK';
