# Safari Hub

Localized hospitality operating system.  
Stack: **Next.js (PWA) + Supabase PostgreSQL** (SQL schema — not Prisma migrations).

**Public frontend (GitHub Pages):** https://kinoti-mitchell.github.io/safarihub/  
**User manual:** [USER_MANUAL.md](./USER_MANUAL.md) — travellers, operators, and admins.

## What it does

| Area | Features |
|------|----------|
| **Positioning** | Hospitality OS — operators run the business; travellers are a demand channel |
| **Roles** | Admin · Tourist · Provider (+ staffing invites) |
| **Listings** | Places, tours/experiences, events, and travel packages (multi-category) |
| **Browse** | Stay / Eat / Move / Explore / Meet + filters (type, amenity, price, county) |
| **Bookings** | M-Pesa STK (Daraja), Card (sandbox/manual), Cash on arrival, VAT receipts |
| **Provider OS** | Listings, inbox, bookings, staffing, supplier marketplace, eTIMS queue, payouts, insights |
| **Admin** | Approvals, KYC, payouts (M-Pesa B2C), suppliers, markets, insights, settings |

## Setup

1. Copy `.env.example` → `.env` (Supabase + Auth secrets).
2. In **Supabase SQL Editor**, run:
   - Fresh DB: `db/safari-hub.sql`
   - Existing DB: also run `db/2026-features.sql` (amenities, place details, `listingKinds`, inbox, etc.)
   - Hospitality OS: `db/2026-hospitality-os.sql` (suppliers, eTIMS queue, provider OS fields)
   - Staff roles (if staffing fails on MANAGER etc.): `db/2026-staff-roles.sql`
   - Category amenities: `db/2026-category-labels.sql` (Hotel under Stay, Wi‑Fi under All, …)
   - Unique identity: `db/2026-unique-identity.sql` (unique phone + company registration)
   - Optional demos: `db/seed-demo-listings.sql` (tour, event, package samples)
3. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Demo logins (if seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@safarihub.ke | admin123456 |
| Tourist | tourist@safarihub.ke | tourist123 |

## Launch checklist

1. **SQL** — `2026-features.sql` and `2026-hospitality-os.sql` applied on production Supabase.
2. **M-Pesa Daraja** (Admin → Settings → M-Pesa): consumer key/secret, shortcode, passkey, public **STK callback** (`https://your-domain/api/mpesa/callback`).  
   B2C payouts: initiator name + security credential; result/timeout URLs default to `/api/mpesa/b2c-result` and `/api/mpesa/b2c-timeout`.
3. **Email** (Settings → Email): Resend or SendGrid API key + from address (password reset, booking mail).
4. **App URLs**: `NEXT_PUBLIC_APP_URL` and `AUTH_URL` = live HTTPS URL.
5. **Card**: sandbox test cards by default; set Card processing to *manual* if you confirm cards offline. Wire Stripe Elements / Pesapal for real PCI card capture later.
6. **Providers**: ensure payout phone is set on the provider profile before **Pay M-Pesa**.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development |
| `npm run build` / `npm run start` | Production build (full Next.js app) |
| `npm run build:pages` | Static public frontend → `dist/` (GitHub Pages) |

## Deploy (GitHub Pages — public frontend)

Same pattern as intern / TRace:

1. Repo **Settings → Pages → Source: GitHub Actions**
2. Push to `main` (workflow: `.github/workflows/deploy-pages.yml`)
3. Live site: https://kinoti-mitchell.github.io/safarihub/

This hosts the marketing frontend only. Booking, auth, provider, and admin need the full Next.js app (`npm run dev` or a Node host).

## Deploy (Render — full app)

1. Push to GitHub → Render Blueprint (`render.yaml`).
2. Set env from `.env.example` (Supabase, `AUTH_SECRET`, app URL).
3. Point Daraja callback URLs at the Render hostname.

## Policies

Public pages (editable in Admin → Settings → Legal):

- [/legal/about](/legal/about)
- [/legal/terms](/legal/terms)
- [/legal/privacy](/legal/privacy)
- [/legal/cancellation](/legal/cancellation)

Tourists can cancel before check-in / event start; paid bookings are marked refunded in-app (processor refund follows M-Pesa/card rules).
