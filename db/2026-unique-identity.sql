-- Safari Hub — unique identity constraints
-- Run in Supabase SQL Editor after base schema.
-- Email is already UNIQUE on "User".
-- Phone: one login account per number.
-- Company registration: one provider business per certificate.
-- National ID uniqueness across *different users* is enforced in the app
-- (same owner may attach their ID to more than one of their businesses).

CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_unique"
  ON "User" ("phone")
  WHERE "phone" IS NOT NULL AND btrim("phone") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "Provider_registrationNumber_unique"
  ON "Provider" ("registrationNumber")
  WHERE "registrationNumber" IS NOT NULL AND btrim("registrationNumber") <> '';
