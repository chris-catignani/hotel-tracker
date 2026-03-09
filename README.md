# Hotel Booking Tracker

A personal web app to track hotel bookings and their true net cost after accounting for promotions, loyalty points, credit card rewards, and shopping portal cashback.

Built with Next.js, Prisma, shadcn/ui, and Tailwind CSS.

## Features

- **Booking management** -- Track hotel stays with pre-tax cost, taxes, credit card used, shopping portal, and loyalty points earned; property autocomplete powered by HERE Maps
- **Promotion tracking** -- Define promotions (hotel credits, card offers, portal bonuses, loyalty multipliers) with matching rules
- **Auto-matching** -- Promotions automatically apply to bookings based on hotel chain, credit card, portal, date range, and spend thresholds
- **Net cost calculation** -- See the true cost of each stay after all savings:
  ```
  Net Cost = Total Cost - Promotions - Portal Cashback - Card Rewards
  ```
- **Dashboard** -- Summary stats, savings breakdown by category, and per-hotel-chain analysis
- **Settings** -- Manage your hotel chains, credit cards, and shopping portals

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** -- a running Postgres instance (local or cloud)
- **HERE API key** -- for property name autocomplete (free tier, no credit card required)

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

### HERE Maps API Setup

The booking form uses HERE's Geocoding & Search API to power property name autocomplete. It's free for up to 250,000 requests/month and requires no credit card.

1. Sign up at [developer.here.com](https://developer.here.com)
2. Create a project and generate a **REST API key**
3. Add it to `.env`:

```
HERE_API_KEY="your-here-api-key"
```

The app degrades gracefully without a key — the property name field still works as a plain text input, but autocomplete suggestions won't appear.

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
   - `HERE_API_KEY`: Your HERE REST API key (see HERE Maps API Setup above)
8. Run `npm run db:seed` via Vercel's one-off task runner or a local connection to the production DB to create the admin user.

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
