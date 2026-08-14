# Rentaj — Technical Documentation

Rentaj is a commission-free rental marketplace for the Serbian market. Owners publish listings (apartments, event venues, playrooms, vehicles, machinery, warehouses, equipment) and pay a flat subscription; guests book and pay owners directly — Rentaj never touches money. This document covers everything needed to run, extend, and understand the codebase. It complements (never repeats) the two source documents this build was implemented from: **Rentaj MVP.pdf** (scope) and **Rentaj Product Bible.pdf** (92-page spec — business rules R1–R182, architectural decisions ADR-001–030, DB schema, design system, email copy).

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend | NestJS (TypeScript) | Modular DI, guards/pipes, first-class OpenAPI — matches the Bible's "clear separation of concerns" requirement |
| ORM / DB | Prisma + PostgreSQL 16 | Typed schema close to Ch.17's table definitions; raw-SQL migration layer for what Prisma can't express (GiST exclusion constraint, triggers) |
| Cache / queue backing | Redis (via `ioredis`) | Category tree, search facets, rate limiting |
| Auth | Passport (local + Google OAuth2), JWT access+refresh, TOTP 2FA (admin only) | Matches R12/R13 (role is *derived*, never stored) and R127 |
| Email | Nodemailer + MJML, DB-backed templates | R166 — copy must be admin-editable without a deploy |
| Frontend | Nuxt 3 (Vue 3 Composition API, plain JS) | SSR for SEO; talks to the backend over HTTP only |
| State | Pinia | Auth/session state |
| i18n | `nestjs-i18n` (backend) + `@nuxtjs/i18n` (frontend) | R137/R138 — Serbian live, English scaffolded |
| Styling | Hand-built flat SCSS design system (no Bootstrap, no nesting) | Ch.18 design tokens transcribed 1:1 |
| Maps | Leaflet + OpenStreetMap | No API key needed for the map itself; Google Maps geocoding is optional/pluggable |
| Containerization | Docker Compose (postgres, redis, backend, frontend, maildev, adminer) | One-command bring-up |

---

## 2. Project structure

```
rentaj_custom/
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── config/configuration.ts        # typed env var loader
│   │   ├── common/                        # cross-cutting: cache, email, payment,
│   │   │                                   # fiscalization, geocoding, uploads, i18n,
│   │   │                                   # guards, decorators, filters, utils
│   │   ├── modules/                       # one folder per feature, mirrors the
│   │   │                                   # Bible's chapters: auth, users, taxonomy,
│   │   │                                   # listings, search, availability, bookings,
│   │   │                                   # messaging, reviews, subscriptions, admin,
│   │   │                                   # dashboard, notifications, email
│   │   ├── prisma/prisma.service.ts
│   │   └── app.module.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/                    # hand-numbered, hand-written SQL for
│   │   │                                   # anything Prisma can't express (see §6)
│   │   ├── seed.ts
│   │   └── email-templates.seed-data.ts   # all 45 email templates, SR+EN
│   └── i18n/{sr,en}/*.json                # validation/error/notification strings
└── frontend/
    ├── pages/                             # file-based routing; Serbian-language
    │                                       # URL slugs throughout (/oglasi, /pretraga,
    │                                       # /kontrolna-tabla, /admin, ...)
    ├── components/{layout,listings,search,admin,dashboard}/
    ├── composables/useApi.js              # the *only* place that talks to the backend
    ├── stores/auth.js                     # Pinia
    ├── middleware/{auth,admin}.js
    ├── locales/{sr,en}.json
    ├── assets/scss/                       # design tokens, grid, typography, components
    └── server/api/_sitemap-urls.ts        # dynamic sitemap source
```

---

## 3. Running it

### Docker (recommended — this is the supported, verified path)

```bash
docker compose up --build
```

Brings up Postgres, Redis, MailDev (SMTP catcher), Adminer, the backend, and the frontend. The backend container runs `prisma migrate deploy && prisma db seed && nest start --watch` on boot, so a clean checkout is fully migrated and seeded automatically.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001/api/v1 |
| Swagger / OpenAPI | http://localhost:3001/api/v1/docs |
| MailDev (catches every outgoing email) | http://localhost:1080 |
| Adminer (DB inspection) | http://localhost:8081 |

Seeded admin login: `admin@rentaj.rs` / `ChangeMe123!` (2FA required — see §9).

### Without Docker

Copy `.env.example` → `.env` in both `backend/` and `frontend/`, point `DATABASE_URL`/`REDIS_HOST` at wherever Postgres/Redis actually run, then:

```bash
cd backend && npm install && npx prisma migrate deploy && npx prisma db seed && npm run start:dev
cd frontend && npm install && npm run dev
```

**Known issue (this environment only, not the Docker path):** `npm run dev` in the frontend hits a bug in the `srvx`/`h3` HTTP listener stack — every request returns `426 Upgrade Required`, traced to the Node/Windows-host combination, not application code (confirmed absent inside the Linux Docker container, and unaffected by Node version or `srvx` patch level). If you hit this: use `npm run build && npm run preview` instead, or verify the Docker path.

---

## 4. Database

Full schema: `backend/prisma/schema.prisma` (~50 models). Design principles applied throughout (P1–P7, Ch.17):

- **P1** — UUID primary keys everywhere.
- **P2** — Category attributes are EAV (`CategoryAttribute`/`AttributeOption`/`ListingAttribute`), never fixed columns. A subcategory's attributes are the union of every ancestor's, resolved by walking the tree at read time (`TaxonomyService.resolveAttributesForCategory`) — never copied down.
- **P3** — Soft-delete/anonymize, never hard-delete (`User.anonymizedAt`, `Listing.status = DELETED` + `deletedAt`).
- **P4** — Money is `BigInt`, stored as **para** (RSD × 100), never a float. `common/utils/money.ts` (`rsdToPara`/`paraToRsd`) is the only place that should ever touch this conversion. **Every** Prisma query that returns a money field to an API response must convert it before the response leaves the service — a raw `BigInt` crashes `JSON.stringify`. This was audited backend-wide (see §14, "Known gaps and things worth re-checking").
- **P5** — All timestamps are UTC `TIMESTAMPTZ`.
- **P6** — Permissions are a flat list (`Permission`/`UserPermission`), never role names. There is no `role` column on `User` anywhere — "owner" is derived (≥1 `ACTIVE` listing), "admin" is derived (≥1 permission grant).
- **P7** — Prices, limits, and toggles live in the `Setting` table (admin-editable, R171), never hardcoded.

### Things Prisma can't express — hand-written migrations

`backend/prisma/migrations/*_constraints_and_extensions/migration.sql` adds, by raw SQL:
- `btree_gist`/`pg_trgm` extensions.
- **`blocked_term_no_overlap`** — a `GIST` exclusion constraint on `BlockedTerm(listingId, tstzrange(startsAt, endsAt))`. This is the actual mechanism that makes double-booking impossible: a concurrent request racing an existing lock fails atomically at the database level. `AvailabilityService.lockTerm()` is the only code path allowed to write `BlockedTerm` rows, and it string-matches the constraint name in the caught Postgres error (Prisma has no typed error code for exclusion violations, unlike unique violations).
- Trigger functions: category depth ≤ 3, category-delete protection, photo/FAQ count limits, subscription listing-limit enforcement, self-booking prevention, review-requires-completed-booking, price-unit-allowed-for-category.

### Migration workflow used throughout this build

`prisma migrate dev` hangs/fails non-interactively in this environment whenever a migration has a destructive-change warning. The working pattern, used for every migration in this repo: create a timestamped folder under `prisma/migrations/` by hand, write `migration.sql` directly, then `npx prisma migrate deploy`.

---

## 5. API

Full interactive reference: **`/api/v1/docs`** (Swagger, generated from the same decorators as the code — always current, so it isn't duplicated here). One controller per feature module, matching the file layout in §2:

`auth`, `users`, `taxonomy` (categories/attributes/locations), `listings`, `search`, `listings/:id/availability` + `ical`, `bookings`, `conversations` (messaging), `reviews`, `subscriptions` + `featured` + `packages`, `admin/*`, `dashboard`, `notifications`.

Conventions:
- Every endpoint is protected by a global JWT guard by default; `@Public()` opts a route out (registration, login, public listing/category/search reads, category-page SEO data).
- Admin endpoints additionally require `@RequirePermissions('permission_key')`, checked against the flat `UserPermission` table (P6) — never a role string.
- Search is `POST /search` (not a GET querystring) because its body includes a nested attribute-filter array and map-bounds object that don't serialize cleanly as query params, and results aren't meaningfully cacheable per-URL anyway (ranking mixes in randomness per R146).
- Validation errors are translated (see §7) rather than raw class-validator messages.

---

## 6. i18n

- **Backend**: `nestjs-i18n`. `backend/i18n/{sr,en}/*.json`. A custom exception-message factory (`common/i18n/validation-error.factory.ts`) maps class-validator constraint names to translation keys — the library's own `i18nValidationMessage()` proved unreliable (CLS-context timing issues produced garbled generic errors). Every thrown exception in the codebase calls `this.i18n.t(key)`; a raw key string as the exception message is a bug (this was grepped for and fixed backend-wide — see §14).
- **Frontend**: `@nuxtjs/i18n` v10. `frontend/locales/{sr,en}.json`. Serbian is the only *active* locale (`nuxt.config.ts` registers only `sr`); English exists structurally in the same files, fully translated, but isn't wired into the language switcher yet — this matches R138 ("scaffolded, not launch-priority") exactly. No UI string is ever hardcoded in a `.vue` file.
- **Category/attribute/option names** go through a generic `Translation` table (`entityType`, `entityId`, `field`, `language`, `value`) rather than `_sr`/`_en` columns, so adding a language later is a data migration, not a schema one.

---

## 7. Email system

`common/email/email.service.ts` is the **only** place that ever calls `nodemailer.sendMail()` — no feature service sends email directly.

1. A domain event fires (`this.events.emit('booking.confirmed', {...})`) via `@nestjs/event-emitter`. Modules communicate through events rather than importing each other's services, specifically to avoid circular module dependencies (e.g. Listings ↔ Subscriptions).
2. A listener in `modules/email/listeners/*.ts` (one file per domain: account, listing, booking, review, subscription, admin, data-protection) catches it, resolves the recipient(s) and any data the template needs, and calls `EmailService.send()`.
3. `EmailService.send()` looks up the `EmailTemplate` row by `(key, language)`, interpolates `{token}` placeholders into the subject/heading/body/button-label (admin-editable text — R166), renders the shared MJML layout (`common/email/mjml-layout.ts`, matching Ch.22.3's structure: logo header → title → one paragraph → one main button → optional boxed "extra data" block → footer with contact + notification-settings link), sends it, and writes an `EmailLog` row regardless of success/failure (R170 — proof of delivery, needed to demonstrate the pre-charge notice actually went out).
4. Structured, non-editable data (IPS QR code image, bank account, payment deadline, invoice numbers) is never part of the admin-editable template — it's assembled by the listener as raw MJML and passed as `extraMjml`, kept deliberately separate from the free-text fields per R171/R172 (administrators change *data*, never *logic*).
5. **Every successful send also creates an in-app notification** (`NotificationsService.createFromEmail`, called from inside `EmailService.send()`) — the bell icon in the header is not a second, separately-triggered feature; it reuses the same heading/body/link the email used.

**Templates**: 45 in `backend/prisma/email-templates.seed-data.ts`, seeded in Serbian and English, covering every individually-named trigger in Ch.22.4. The source document's own section headers sum to 46 against a stated total of "41" — an inconsistency in the document itself. This implementation covers every real, distinct trigger rather than dropping several to force a match against an internally inconsistent number. The one skipped trigger, "Promena e-mail adrese" (email address change), has no corresponding feature anywhere in the app to fire it from — building a full change-email-with-reverification flow was out of scope for "the email system."

**Editing copy**: `/admin/email-sabloni` (admin panel) — every template, both languages, subject/heading/body/button-label, live.

**New cron jobs added to wire this up** that didn't previously exist: booking unopened-request reminder (6h), payment-deadline reminders (half-point and final-day), day-before-stay reminder, subscription-expiring-soon (−7/−3/−1 days, autoRenew-off subscriptions only), and a price-drop-on-favorite check. Booking reminders are deduplicated via `Booking.remindersSent String[]`; the price-drop check via `Favorite.priceDropNotifiedAt`.

**Account deletion** (Ch.22.4 "Zahtev za brisanje naloga", R175 — must be confirmed from the registered inbox) is a two-step, token-gated flow that didn't exist before this pass: `POST /users/me/deletion/request` emails a confirmation link; `POST /users/deletion/confirm` (public, token-only — the confirmation may be opened on a device with no active session) performs the actual anonymize-and-cancel. Admin-initiated deletion (`AdminService.deleteUserAsAdmin`) bypasses this gate and calls the underlying `UsersService.executeDeletion()` directly, since the admin already carries that authority.

---

## 8. Caching

Redis, via `common/cache/cache.service.ts` (`get`/`set`/`getOrSet`/`delByPrefix`). Used deliberately narrowly — only for things that are expensive to compute and don't change per-request:

| What | TTL | Invalidated when |
|---|---|---|
| Category tree | 300s | Any admin category create/update/merge/promote/approve/reject |
| Resolved attribute set per category | 300s | Same as above (attribute upsert/delete) |
| Active packages list | 300s | Admin package price update |

Never cached: bookings, messages, availability, anything user-specific or money-adjacent — correctness matters more than shaving a query there.

---

## 9. Auth & security

- Passwords: `argon2`. Sessions: JWT access (15m) + refresh (30d, rotated on use) as httpOnly cookies.
- **2FA is mandatory for admin accounts, no one else** (R127). The bootstrap flow (an admin who has never set up 2FA has no way to generate a secret through an authenticated-only endpoint, since they aren't authenticated yet) is solved with a short-lived purpose-scoped JWT (`signPurposeToken(userId, 'setup-required', ttl)`) issued right after correct-password-but-no-2FA-yet, which is the only credential accepted by `POST /auth/login/2fa/setup-generate`.
- Google OAuth2 is wired but requires real credentials (`GOOGLE_CLIENT_ID`/`SECRET`) to function — unconfigured, the button reaches Google's own "OAuth client not found" error page, not a bug in this codebase.
- `@nestjs/throttler` global rate limiting; Helmet; CORS locked to the frontend origin; every DTO validated with `class-validator` and the global pipe set to `whitelist: true` (unknown properties rejected) — this caught a real bug during this build (see §14).
- Anti-bot: honeypot field + rate-limit heuristic on registration and first-message-in-a-conversation (R177), documented as swappable for hCaptcha/Turnstile later.
- Money never touches this platform (ADR-002) — no card data is ever stored; the mock payment/fiscalization providers exist behind an interface specifically so a real Banca Intesa/Sparkom VP integration is a provider swap, not a rewrite, once those integrations are contracted (Product Bible open items O22/O23).

---

## 10. Responsive design system

`frontend/assets/scss/` — hand-built, flat (no nested selectors, no Bootstrap), transcribed from Ch.18:

- `_tokens.scss` — every color/radius/font-size/spacing value used anywhere in the app. Nothing is ever a hardcoded hex/px outside this file.
- `_breakpoints.scss` + `_grid.scss` — a Bootstrap-shaped 12-column row/col API (`.row`, `.col-6`, `.col-md-4`, ...) built from scratch.
- `_buttons.scss` — the gradient `.btn-primary` is reserved for marketing surfaces (home page hero/CTAs) only; the dashboard/admin use the flat `.btn-primary-flat` (R149).
- Tables that would break on a phone render as stacked cards instead via `.table-responsive-cards` (R156/157) rather than a horizontal-scroll table.
- Mobile: a bottom tab bar (`DashboardBottomNav.vue`) replaces the sidebar nav below the `md` breakpoint; the search page's filter panel becomes a slide-in drawer with a backdrop (`FilterFields.vue` is shared between the desktop sidebar and the mobile drawer so the two never drift).

---

## 11. SEO

- SSR throughout (Nuxt 3), not an SPA — this was the explicit reason Nuxt was chosen over a plain Vue app.
- `useSeoMeta`/JSON-LD structured data: `Product` schema on listing pages (price, rating once ≥3 reviews per R102), `WebSite`+`SearchAction` on the home page.
- Category+city combination pages (`pages/[categorySlug]/[citySlug].vue`) self-report `noindex` via `useSeoMeta({ robots: ... })` until they have ≥3 listings (R135, thin-content avoidance) — computed live from the actual search result count, not a static list.
- `robots.txt`/`sitemap.xml` (`@nuxtjs/robots`/`@nuxtjs/sitemap`): static routes are picked up by Nuxt's own file-based scan; every listing detail page and category page is added dynamically by `frontend/server/api/_sitemap-urls.ts`, which calls `GET /search/sitemap-urls` on the backend. Private routes (`/kontrolna-tabla/**`, `/admin/**`) and pages with no SEO value (auth flows, confirmation links) are excluded from both.

---

## 12. Environment variables

### Backend (`backend/.env`)

| Variable | Purpose |
|---|---|
| `NODE_ENV`, `PORT`, `API_PREFIX`, `FRONTEND_URL` | Basic server config |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_HOST`, `REDIS_PORT` | Cache + BullMQ |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `SESSION_REMEMBER_ME_DAYS` | Auth tokens |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | OAuth (optional — unset disables the button functionally, doesn't crash the app) |
| `TWO_FACTOR_APP_NAME` | Shown in the authenticator app |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS` | Email delivery (MailDev by default) |
| `UPLOADS_DIR`, `UPLOADS_BASE_URL`, `MAX_PHOTO_SIZE_MB`, `MAX_PHOTOS_PER_LISTING` | Photo storage |
| `GEOCODING_PROVIDER`, `GOOGLE_MAPS_API_KEY` | `nominatim` (default, free, no key) or `google` |
| `PAYMENT_PROVIDER`, `BANCA_INTESA_*` | `mock` (default) or real Banca Intesa credentials |
| `FISCALIZATION_PROVIDER`, `SPARKOM_VP_*` | `mock` (default) or real Sparkom VP credentials |
| `ANTI_BOT_HONEYPOT_FIELD`, `RATE_LIMIT_TTL_SECONDS`, `RATE_LIMIT_MAX_REQUESTS` | Abuse prevention |
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` | First admin account, created by `prisma db seed` |

### Frontend (`frontend/.env`)

| Variable | Purpose |
|---|---|
| `NUXT_PUBLIC_API_BASE` | Backend URL reachable from the **visitor's browser** |
| `NUXT_API_BASE_INTERNAL` | Backend URL reachable from **this process** (SSR fetches). Same host as above for non-Docker runs; `docker-compose.yml` overrides it to `http://backend:3001/api/v1` so the frontend container reaches the backend container by service name |
| `NUXT_PUBLIC_SITE_URL` | Canonical URL, used in sitemap/structured data |
| `NUXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional — only needed if `GEOCODING_PROVIDER=google` |

---

## 13. Assumptions and documented open items

The Product Bible flags several items as genuinely undecided ("Za odlučivanje") rather than specified. Each was resolved with a documented, reasonable default rather than left unbuilt:

- **O16** (concrete attribute list per category) — seed data provides a representative attribute set per top-level category (Nekretnine, Vozila, etc.), not an exhaustive one. Adding more is an admin-panel action (`/admin/kategorije`), not a code change.
- **O13** (home page adapted to seven/eight categories) — built from the Ch.18 design tokens directly (hero search + category grid + a per-category "featured" row for the first five categories with any listings + a "how it works" section + owner CTA), since Figma was never connected this session. Swapping in pixel-exact Figma output later is a component-level change, not a rebuild.
- **O17/O18** (daily new-conversation limit, iCal sync frequency) — seeded as `Setting` rows (`daily_new_conversation_limit: 10`, iCal sync runs hourly), both admin-editable/code-adjustable without being hardcoded into logic.
- **IPS QR payload** — built from the publicly documented NBS field structure (`common/utils/ips-qr.ts`). Not validated against NBS's own conformance test suite — worth doing before accepting real payments in production, even though the platform never touches the money itself (ADR-002).
- **Payment/fiscalization providers** (O22/O23 — Banca Intesa tokenization, Sparkom VP e-Fakture/SEF coverage) — both are genuinely external confirmations, not code problems. Implemented behind a provider interface with a full mock implementation so the real integration is a swap-in once contracted.

---

## 14. Notable bugs found and fixed during this build

Worth knowing about because they're the kind that don't show up until you actually click through the app, not from reading the code:

- **BigInt/JSON serialization** — every Prisma money field (`BigInt`, para units per P4) crashes `JSON.stringify` if returned raw. Audited across every service returning a `Listing`/`Booking`/`Subscription`/`Package`/`Transaction`/`Invoice`/`FeaturedListing`/`DefinedSlot`/`Favorite` field to an API response; each now converts via `paraToRsd()` before the response leaves the service, or excludes the field from the `select` entirely. The riskiest ones found: `UsersService.getPublicProfile()` (hit on every single owner-profile page view) and `AvailabilityService.getAvailability()`'s `DefinedSlot.price` (a public endpoint).
- **`UpdateSettingDto.value: unknown` had no `class-validator` decorator** — under the global `whitelist: true` pipe, an undecorated property is silently stripped, so every admin settings save returned 400. Caught by actually clicking Save in the browser, not by type-checking. Fixed with `@IsDefined()`.
- **Date formatting defaulted to Cyrillic month names** (`sr-RS` resolves to Cyrillic in Node's ICU data) against the rest of the Latin-script UI (`sr-Latn-RS`, matching `<html lang>`). Only visible in rendered email content, not in code review.
- **Frontend SSR fetches silently returned empty data** whenever a `.env` had `NUXT_API_BASE_INTERNAL` pointing at the Docker-only hostname `backend:3001` while actually running outside Docker — `.env.example`'s own default value contradicted its own comment ("for local non-docker runs"). This is why the home page's category/search rows, and any page reached via a fresh full-page load rather than a client-side link click, rendered empty during local (non-Docker) testing. Confirmed the Docker Compose path was never affected (`docker-compose.yml` hardcodes the correct value in its `environment:` block regardless of `.env`); fixed the `.env.example` default for anyone running the non-Docker path.
- Several raw i18n key strings thrown as exception messages instead of `this.i18n.t(key)` (e.g. `AvailabilityService`'s term-conflict error) — grepped for across the whole backend after finding the first instance, all fixed.
- A stateful-regex bug in `common/utils/contact-detector.ts` (a `g`-flagged regex used with `.test()`, which is stateful across calls — classic JS gotcha).

---

## 15. What's out of scope / next-phase items

Per the Bible's own "Za naredne verzije" (next versions) list, intentionally not built: rating criteria broken down per category (O19), extended dashboard analytics (O20), a dedicated mobile dashboard layout (O21), an agency-tier package above Pro, verified-owner badges, team accounts/organizations, SMS notifications.

Also not built, and worth flagging explicitly rather than silently omitting: a real payment/fiscalization provider (mock only, by design — see §13), NBS IPS-QR conformance validation, and an actual production transactional email provider swap-in (MailDev only, by design for dev).
