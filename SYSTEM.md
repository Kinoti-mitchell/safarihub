# Safari Hub — System Documentation

**Version:** August 2026  
**Stack:** Next.js 16 (App Router, PWA) · Auth.js · Supabase PostgreSQL · Vercel  
**Related:** [USER_MANUAL.md](./USER_MANUAL.md) (how to use the product) · [README.md](./README.md) (setup & deploy)

---

## 1. What the system does

Safari Hub is a Kenya-focused **hospitality operating system**. Travellers discover and book stays, dining, transport, experiences, events, and travel packages. Operators (hotels, venues, tour and transfer businesses) run demand, staffing, suppliers, inventory, compliance, and payouts in one place. Platform admins govern markets, approvals, boosts, and settlements.

Positioning: operators run the business; travellers are a demand channel.

Live app target: Vercel + Supabase. The app is installable as a PWA.

---

## 2. Roles

| Layer | Role | Home | Responsibility |
|--------|------|------|----------------|
| Platform | `TOURIST` | `/account` | Browse, book, pay, review, loyalty, messages |
| Platform | `PROVIDER` | `/provider` | Business owner / operator |
| Platform | `ADMIN` | `/admin` | Approvals, payouts, settings, RBAC |
| Provider staff | `OWNER`, `MANAGER`, `FRONT_DESK`, `ACCOUNTANT` | `/provider` (scoped) | Path-level permissions via `ProviderMember` |
| Guest (no account) | Checkout visitor | Booking manage link | Name/email/phone + `accessToken` on booking |
| Organization | Org member | Account / bookings | Business-travel bookings may attach `organizationId` |

Admin permissions are defined in RBAC (`RoleDefinition`); base `ADMIN` has full access.

---

## 3. Product modules

### Discover (public)

- Categories: **Stay / Eat / Move / Explore / Meet**
- Listing kinds: place, experience, event, package
- Browse + filters (type, amenity, price, county)
- Destinations, events, travel packages
- Client trip planner (`/trip`) — multi-stop shortlist in local storage (not a server booking)

### Bookings & commerce

- Listing bookings (overnight and day-use) with room/offer inventory
- Travel packages (platform- and provider-owned)
- Payments: **M-Pesa STK**, **card** (sandbox or manual confirm), **cash on arrival**
- VAT receipts, loyalty earn/redeem, post-stay reviews
- Inquiries (leads) and inbox (conversation threads)

### Provider OS (`/provider`)

Bookings (list + calendar), inbox, reviews, listings, packages, staff, suppliers, inventory, compliance (KYC + eTIMS), payouts, analytics, multi-business switcher. Tour-ops nav variants for tour operator / transfer / camp.

### Admin (`/admin`)

Approvals & KYC, listings, bookings, payouts (including M-Pesa B2C), users/roles, markets, suppliers, reviews, boosts/featured, content, reports, logs, platform settings.

### Monetization

Commission on payouts, listing publish fee, paid boosts, featured carousel, optional provider auto-approve rules.

### Ops desks (admin)

- **Payments desk** (`/admin/payments`) — stuck STK, failed payments, refunds, B2C exceptions; re-query / confirm / reverse
- **Payouts** — batch B2C / mark paid with KYC + payout-phone + dispute guards; `ON_HOLD` status
- **Disputes** (`/admin/disputes`) — hold payouts; resolve guest / provider / partial
- **eTIMS desk** (`/admin/etims`) — queue, retries, drain; auto-queue on paid when enabled
- **KYC decline** — structured rejection checklist codes on provider approve queue

---

## 4. Key flows

### 4.1 Listing booking

1. Guest or member selects listing, offer, dates/guests, and payment method → `POST /api/bookings`.
2. Availability and VAT are calculated; guest details are stored on the booking.
3. Status path: `PENDING` → payment → `CONFIRMED` / `RESERVED` (cash may defer payment).
4. Cancel restores room inventory when applicable.
5. After checkout date, bookings move to `COMPLETED` (hourly cron + opportunistic list refresh) and receive a `reviewToken` when needed.
6. Access via account or booking `accessToken` manage link.

**Statuses:** `PENDING` · `RESERVED` · `CONFIRMED` · `CANCELLED` · `COMPLETED` · `NO_SHOW`

### 4.2 Payments

| Method | Behaviour |
|--------|-----------|
| **M-Pesa** | Safaricom Daraja STK Push → `/api/mpesa/callback`. Booking confirms only after a successful callback. |
| **Card — sandbox** | Luhn + test-card validation in memory; PAN never stored; booking confirms immediately on success. |
| **Card — manual** | Details accepted; payment stays `PENDING` until provider/admin **Confirm card paid** (`POST /api/bookings/[id]/card`). |
| **Cash on arrival** | Provider/admin records cash (`POST /api/bookings/[id]/cash`). |

Shared success path (`confirmBookingPaid`): payment `PAID`, booking confirmed (when auto-confirm is on), payout row (net of commission), loyalty award, receipt number, notify/email.

Package bookings use the same payment methods; M-Pesa can attach via `Payment.packageBookingId` and package payment poll routes.

### 4.3 Packages

- Public: `/packages`, `/packages/[slug]`, manage `/packages/bookings/[id]`
- Provider CRUD: `/provider/packages` + `/api/provider/packages`
- Guest-capable `PackageBooking` with access token

### 4.4 Loyalty

- Earn on paid booking: `floor(amount / loyalty.kesPerPoint)` → ledger
- Redeem via `/api/loyalty/redeem` or inline on booking when `flags.loyaltyEnabled`
- UI: `/account/loyalty`

### 4.5 Reviews

- Only when booking is `COMPLETED`; one review per booking
- Member by `travelerId`, or guest via `accessToken` / `reviewToken`
- Provider reply; admin moderation

### 4.6 Payouts

- Created when a listing booking is paid (amount after commission)
- Provider views `/provider/payouts` (settlement cadence from settings)
- Admin marks status or sends M-Pesa B2C; callbacks `/api/mpesa/b2c-result`, `/api/mpesa/b2c-timeout`
- Requires provider payout phone

### 4.7 Inquiries vs inbox

- **Inquiry** — lead form on a listing (`Inquiry` NEW / REPLIED / CLOSED)
- **Inbox** — `Conversation` + `Message` threads (tourist ↔ provider), including guest fields

### 4.8 eTIMS / compliance

Providers queue paid receipts with a receipt number (`EtimsSubmission`). Platform mode (Admin → Settings → Compliance):

| Mode | Behaviour |
|------|-----------|
| **manual** | Queue; staff marks submitted with optional KRA reference |
| **sandbox** | On queue (and via cron), assign a sandbox KRA ref and mark `SUBMITTED` |
| **live** | POST JSON receipt to `compliance.etimsApiUrl` with Bearer `compliance.etimsApiKey` |

Cron: `/api/cron/etims-submit` every 6 hours drains `QUEUED` rows in sandbox/live modes.

### 4.9 Booking completion (cron)

- **Hourly:** `GET/POST /api/cron/complete-bookings` — past `CONFIRMED`/`RESERVED` with `checkOut` in the past → `COMPLETED`
- Also runs opportunistically when a traveler or provider loads their booking list
- Authorize with `Authorization: Bearer $CRON_SECRET` (required in production)

---

## 5. Architecture

```
Browser (PWA)
  → src/app/* pages (public · account · provider · admin)
  → src/app/api/* route handlers
  → src/lib/* domain (auth, bookings, payments, mpesa, etims, settings, rbac, …)
  → Supabase Postgres
```

| Layer | Choice |
|--------|--------|
| App | Next.js 16.2 App Router, React 19, TypeScript, Tailwind 4 |
| Auth | Auth.js v5 (JWT), credentials + phone OTP |
| Data | Supabase PostgreSQL via service client (`src/lib/supabase.ts`); SQL schema in `db/` |
| Validation | Zod |
| Email | SMTP / Resend / SendGrid (settings-driven) |
| Payments | Daraja STK + B2C; card sandbox/manual |
| Jobs | Vercel Cron (`vercel.json`) |
| Deploy | Vercel (primary); optional Render |

Middleware forwards `x-pathname` for the maintenance gate; it is not a full auth gate.

---

## 6. Important API surfaces

| Area | Routes (representative) |
|------|-------------------------|
| Bookings | `/api/bookings`, `/api/bookings/[id]`, `…/cash`, `…/card`, `…/review` |
| M-Pesa | `/api/mpesa/callback`, `…/b2c-result`, `…/b2c-timeout` |
| Packages | `/api/packages/[id]/book`, `/api/packages/bookings/[id]/payment`, `/api/provider/packages` |
| Loyalty | `/api/loyalty`, `/api/loyalty/redeem` |
| Provider | `/api/provider/*` (bookings, staff, suppliers, compliance, payouts, …) |
| Admin | `/api/admin/*` (payouts, providers, settings, …) |
| Public | `/api/public/payments`, `/api/public/platform` |
| Cron | `/api/cron/complete-bookings`, `/api/cron/etims-submit` |

---

## 7. Data & migrations

Core schema: `db/safari-hub.sql`. Incremental ops scripts (safe to re-run where noted) include:

| Script | Domain |
|--------|--------|
| `2026-features.sql` | KYC, cancel trail, favorites, inbox, day-use, VAT/cash/receipts |
| `2026-hospitality-os.sql` | Suppliers, eTIMS queue, provider OS fields |
| `2026-staff-roles.sql` | OWNER / MANAGER / FRONT_DESK / ACCOUNTANT |
| `2026-guest-checkout.sql` | Nullable traveler; guest fields + accessToken |
| `2026-tourist-essentials.sql` | Guest-capable package bookings |
| `2026-tourist-ops.sql` | Package payments on Payment; reviewToken; guest reviews |
| `2026-provider-ops.sql` | Tour listing fields; provider-owned packages |
| `2026-listing-publish-fee.sql` | Pay-to-publish |
| `2026-boost.sql` | Boost plans / requests |
| `2026-backfill-guest-details.sql` | Backfill guest\* from User on existing rows |
| `2026-ops-hardening.sql` | Refunds, PaymentEvent, Dispute, Trip, payout ON_HOLD, booking support, eTIMS retries |

**Payment statuses:** `PENDING` · `PAID` · `FAILED` · `REFUNDED` · `NOT_REQUIRED`  
**Payout statuses:** `PENDING` · `PROCESSING` · `PAID` · `FAILED`  
**Listing statuses:** `DRAFT` · `PENDING_REVIEW` · `PUBLISHED` · `SUSPENDED`

---

## 8. Configuration checklist

1. Apply SQL migrations on Supabase (see README).
2. Env: Supabase keys, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.
3. Admin → Settings → M-Pesa (Daraja) credentials and public STK/B2C callback URLs.
4. Admin → Settings → Email.
5. Admin → Settings → Payments (which methods; card sandbox vs manual).
6. Admin → Settings → Compliance (eTIMS mode; live URL/key if used).
7. Providers set payout phone before B2C payouts.

---

## 9. Document map

| Doc | Audience |
|-----|----------|
| `SYSTEM.md` (this file) | Engineers & operators — what the system is and how it works |
| `USER_MANUAL.md` | End users — step-by-step UX |
| `README.md` | Developers — install, migrate, deploy |
