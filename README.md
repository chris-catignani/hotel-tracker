# Hotel Booking Tracker

A personal web app to track hotel bookings and their true net cost after accounting for promotions, loyalty points, credit card rewards, and shopping portal cashback.

Built with Next.js, Prisma, shadcn/ui, and Tailwind CSS.

## Features

- **Booking management** -- Track hotel stays with pre-tax cost, taxes, credit card used, shopping portal, and loyalty points earned; property autocomplete powered by Google Places API
- **Promotion tracking** -- Define promotions (hotel credits, card offers, portal bonuses, loyalty multipliers) with matching rules
- **Auto-matching** -- Promotions automatically apply to bookings based on hotel chain, credit card, portal, date range, and spend thresholds
- **Net cost calculation** -- See the true cost of each stay after all savings:
  ```
  Net Cost = Total Cost - Promotions - Portal Cashback - Card Rewards
  ```
- **Dashboard** -- Summary stats, savings breakdown by category, and per-hotel-chain analysis
- **Price Watch** -- Monitor live hotel rates (cash + award) for upcoming stays; email alerts when prices drop below your thresholds
- **Settings** -- Manage your hotel chains, credit cards, and shopping portals

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** -- a running Postgres instance (local or cloud)
- **Google Places API key** -- for property name autocomplete (~$200/month free credit; billing account required)

## Local Development Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/chris-catignani/hotel-tracker.git
cd hotel-tracker
npm install
```

### 2. Set up the database

Copy the example env file and update `DATABASE_URL` with your Postgres connection string:

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hotel_tracker"
```

If you need to create the database first:

```bash
psql -U postgres -c "CREATE DATABASE hotel_tracker;"
```

### 3. Push schema to database

```bash
npm run db:push
```

### Google Places API Setup

The booking form uses the Google Places API (New) to power property name autocomplete, with `includedType: lodging` so only hotels appear in results.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create or select a project
2. Enable the **Places API (New)** (not the legacy Places API)
3. Create an API key under **APIs & Services → Credentials**
4. Optionally restrict the key to **Places API (New)** to limit exposure
5. Add it to `.env`:

```
GOOGLE_PLACES_API_KEY="your-google-places-api-key"
```

The app degrades gracefully without a key — the property name field still works as a plain text input, but autocomplete suggestions won't appear.

> **Pricing:** Google provides ~$200/month in free credit. Only Basic tier fields are requested (display name, address components, location), which are billed at $32/1,000 requests — roughly 6,000 free searches per month. A billing account is required even for the free tier.

### Authentication Setup

Copy `.env.example` to `.env` and set a strong `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Add to `.env`:

```
AUTH_SECRET="<your-generated-secret>"
SEED_ADMIN_EMAIL="your@email.com"
SEED_ADMIN_PASSWORD="your-secure-password"
```

### 4. Seed reference data (optional)

Loads sample hotel chains, credit cards, shopping portals, bookings, and promotions. Also creates the first admin user using `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env`.

```bash
npm run db:seed
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route                   | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `/`                     | Dashboard with stats, recent bookings, savings breakdown  |
| `/bookings`             | All bookings list with net cost                           |
| `/bookings/new`         | Add a new booking                                         |
| `/bookings/[id]`        | Booking detail with cost breakdown and applied promotions |
| `/bookings/[id]/edit`   | Edit a booking                                            |
| `/promotions`           | All promotions with type-based tabs                       |
| `/promotions/new`       | Add a new promotion                                       |
| `/promotions/[id]/edit` | Edit a promotion                                          |
| `/price-watch`          | All price watches with latest rates and alert thresholds  |
| `/settings`             | Manage hotels, credit cards, and shopping portals         |

## Database Schema

Six tables managed by Prisma:

- **hotels** -- Hotel chains and their loyalty programs
- **credit_cards** -- Cards with reward type, earn rate, and point value
- **shopping_portals** -- Cashback portals (Rakuten, TopCashback, etc.)
- **bookings** -- Hotel stays with all cost fields and references to card/portal used
- **promotions** -- Promotion rules with type, value, matching criteria, and date ranges
- **booking_promotions** -- Join table tracking which promotions were applied to which bookings

## Useful Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:push      # Push schema to database
npm run db:seed      # Seed reference data
npm run db:generate  # Regenerate Prisma client
npm run test         # Run unit tests (Vitest)
npm run test:e2e     # Run functional E2E tests (Playwright)
npx prisma studio    # Open Prisma Studio (visual DB browser)
```

## Functional Testing (E2E)

We use **Playwright** for end-to-end functional tests.

### 1. Setup

Add a dedicated test database URL to your `.env` file. You do not need to create the database manually; Prisma will create it for you if it doesn't exist.

```
DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5432/hotel_tracker_test"
```

### 2. Run Tests

```bash
npx playwright install  # Install browser engines (first time only)
npm run test:e2e        # Run tests headlessly (AI/CI default)
npm run test:e2e:show   # Run tests and open HTML report (Human default)
npm run test:e2e:ui     # Run tests with interactive UI
```

The E2E suite automatically resets and seeds the test database before running.

### 3. Auth Setup for E2E Tests

`AUTH_SECRET` must be set in your `.env` file for E2E tests to work. The test server needs it to sign and verify JWT cookies.

### 4. Debugging Failures

If a test fails, Playwright is configured to record a video and a "trace" (interactive debug log).

#### Locally

1. Run tests using `npm run test:e2e:show`.
2. The browser will open the report automatically.
3. Click on a failed test and scroll to the **Video** or **Traces** section.

#### In CI (GitHub Actions)

1. Go to the **Actions** tab in your GitHub repository.
2. Click on the failed workflow run.
3. Scroll down to the **Artifacts** section at the bottom.
4. Download the `playwright-report` to view videos and interactive traces.

## Deploying to Vercel

1. Push your repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add a Postgres database (Neon or Vercel Postgres) from the Vercel dashboard
4. Vercel will automatically set `DATABASE_URL` -- ensure it matches your Prisma config
5. Add a build command override if needed: `npx prisma generate && next build`
6. After the first deploy, push the schema: `npx prisma db push`
7. Add required environment variables in Vercel project settings:
   - `AUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `SEED_ADMIN_EMAIL`: Your admin email
   - `SEED_ADMIN_PASSWORD`: A strong password
   - `GOOGLE_PLACES_API_KEY`: Your Google Places API key (see Google Places API Setup above)
   - `CRON_SECRET`: Generate with `openssl rand -base64 32` (used to authenticate cron endpoints)
   - `RESEND_API_KEY`: From [resend.com](https://resend.com) (required for price drop email alerts)
   - `RESEND_FROM_EMAIL`: Verified sender address on Resend (required for price drop email alerts)
   - `HYATT_SESSION_COOKIE`: Browser session cookie from hyatt.com (required for Hyatt price monitoring — see [Price Watch Setup](#price-watch-setup))
8. Run `npm run db:seed` via Vercel's one-off task runner or a local connection to the production DB to create the admin user.

## Exchange Rate Cron Job

The app supports non-USD bookings. Exchange rates are stored in the `ExchangeRate` table and refreshed daily via a Vercel Cron Job.

### How it works

- **Schedule:** daily at midnight UTC (`0 0 * * *`), configured in `vercel.json`
- **Endpoint:** `GET /api/cron/refresh-exchange-rates`
- **What it does:**
  1. Fetches current rates for all supported currencies (via a free public CDN) and upserts them into the `ExchangeRate` table
  2. Locks in the historical check-in-date rate for any non-USD future bookings whose check-in date has now passed, and recalculates loyalty points in USD at that rate

### Setup on Vercel

1. Generate a secret token:
   ```bash
   openssl rand -base64 32
   ```
2. Add it as an environment variable in your Vercel project settings:

   ```
   CRON_SECRET="<your-generated-secret>"
   ```

   Vercel automatically sends this as `Authorization: Bearer <secret>` when invoking the cron endpoint. The endpoint returns `401` for any request missing a valid token.

3. The cron job is defined in `vercel.json` and Vercel will activate it automatically on deploy — no additional configuration needed.

### Initial data population

The `ExchangeRate` table starts empty. After your first deploy, trigger the cron manually to populate it:

```bash
curl -X GET https://<your-vercel-domain>/api/cron/refresh-exchange-rates \
  -H "Authorization: Bearer <your-cron-secret>"
```

After that, Vercel will keep rates up to date automatically each night.

## Price Watch Setup

The price watch feature monitors live hotel room rates (cash and award/points) for upcoming stays and sends email alerts when prices drop below your configured thresholds.

### Supported Chains

| Chain  | Cash Rates | Award Rates | Notes                             |
| ------ | ---------- | ----------- | --------------------------------- |
| Hyatt  | ✅         | ✅          | Uses session cookie + spirit code |
| Others | —          | —           | Not yet supported                 |

### Email Alerts (Resend)

1. Create a free account at [resend.com](https://resend.com)
2. Add and verify a sender domain (or use the Resend test address)
3. Create an API key
4. Add to your environment:
   ```
   RESEND_API_KEY="re_..."
   RESEND_FROM_EMAIL="alerts@yourdomain.com"
   ```

### Hyatt Rate Monitoring

Hyatt rates are fetched from Hyatt's internal API using an anonymous browser session cookie. No Hyatt account is required.

#### Step 1 — Get the session cookie

1. Open [hyatt.com](https://www.hyatt.com) in your browser (no need to log in)
2. Open DevTools → **Network** tab → reload the page
3. Click any request to `hyatt.com` → **Headers** → **Request Headers**
4. Copy the entire value of the `Cookie:` header
5. Set it as an environment variable:
   ```
   HYATT_SESSION_COOKIE="your_cookie_string_here"
   ```

The cookie typically expires after hours to days. When expired, price fetches silently return no data until the cookie is refreshed.

#### Step 2 — Set the spirit code on a property

The Hyatt API identifies properties by a **spirit code** — a 5-character lowercase string visible in every Hyatt property URL:

```
https://www.hyatt.com/en-US/hotel/illinois/park-hyatt-chicago/chiph
                                                                ^^^^^
                                                           spiritCode = "chiph"
```

Set it on the property via the API:

```bash
curl -X PUT https://your-app.vercel.app/api/properties/{propertyId} \
  -H "Content-Type: application/json" \
  -d '{"chainPropertyId": "chiph"}'
```

#### Step 3 — Enable price watch on a booking

1. Open a booking's detail page
2. Scroll to the **Price Watch** section
3. Toggle it on and optionally set cash/award thresholds
4. Click **Check Now** to fetch current prices immediately

### Cron Schedule (GitHub Actions)

Price watches run daily via GitHub Actions (not Vercel Cron, to avoid the 50MB Playwright bundle limit). The workflow is defined in `.github/workflows/refresh-price-watches.yml` and runs at **6am UTC**.

Add these secrets to your GitHub repository (**Settings → Secrets → Actions**):

| Secret        | Value                                                   |
| ------------- | ------------------------------------------------------- |
| `APP_URL`     | Your production URL, e.g. `https://your-app.vercel.app` |
| `CRON_SECRET` | Same value as the `CRON_SECRET` env var in Vercel       |

You can also trigger the workflow manually from the **Actions** tab, or call the endpoint directly:

```bash
curl -X GET https://your-app.vercel.app/api/cron/refresh-price-watches \
  -H "Authorization: Bearer <your-cron-secret>"
```

## Managing Users

The app is single-admin by default. To create additional users:

- **Self-registration is closed.** New users can be created via the `POST /api/auth/register` endpoint (see source for payload shape).
- **Admin users only** can write to reference data (hotel chains, credit cards, portals, etc.). Regular users can manage their own bookings and promotions.
- To promote a user to admin, update the `role` column in the `users` table: `UPDATE users SET role = 'ADMIN' WHERE email = 'user@example.com';`

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL with Prisma 6 ORM
- **UI:** Tailwind CSS + shadcn/ui
- **Language:** TypeScript
