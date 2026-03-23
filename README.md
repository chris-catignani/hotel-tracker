# Hotel Booking Tracker

A personal web app to track hotel bookings and their true net cost after accounting for promotions, loyalty points, credit card rewards, and shopping portal cashback.

Built with Next.js, Prisma, shadcn/ui, and Tailwind CSS.

## Features

- **Booking management** — Track hotel and apartment stays with pre-tax cost, taxes, credit card used, shopping portal, and loyalty points earned; property autocomplete powered by Google Places API
- **Multi-currency support** — Book in any currency; exchange rates are locked at check-in so past stay values don't drift
- **Promotion tracking** — Define promotions (hotel credits, card offers, portal bonuses, loyalty multipliers) with matching rules
- **Auto-matching** — Promotions automatically apply to bookings based on hotel chain, credit card, portal, date range, and spend thresholds
- **Net cost calculation** — See the true cost of each stay after all savings: promotions, portal cashback, card rewards, and loyalty points earned
- **Dashboard** — Summary stats, savings breakdown by category, and per-hotel-chain analysis; filter by hotels or apartments
- **Price Watch** — Monitor live hotel rates (cash + award) for upcoming stays; email alerts when prices drop below your thresholds
- **Settings** — Manage your hotel chains, credit cards, and shopping portals

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** — a running Postgres instance (local or cloud)
- **Google Places API key** — for property name autocomplete (billing account required; ~$200/month free credit)

## Local Development Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/chris-catignani/hotel-tracker.git
cd hotel-tracker
npm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hotel_tracker"
AUTH_SECRET="<openssl rand -base64 32>"
GOOGLE_PLACES_API_KEY="your-google-places-api-key"
```

### 3. Set up the database

```bash
npm run db:migrate   # Apply migrations (dev)
npm run db:seed      # Seed reference data + create admin user
```

The seed step uses `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env` to create the first admin user.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing (E2E)

Add a dedicated test database URL to `.env`:

```
DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5432/hotel_tracker_test"
```

```bash
npx playwright install  # Install browser engines (first time only)
npm run test:e2e        # Run tests headlessly
npm run test:e2e:show   # Run tests and open HTML report
npm run test:e2e:ui     # Run tests with interactive UI
```

The E2E suite automatically resets and seeds the test database before running.

## Deploying to Vercel

1. Push your repo to GitHub and import the project in [Vercel](https://vercel.com)
2. Add a Postgres database (Neon or Vercel Postgres) from the Vercel dashboard
3. Add required environment variables in Vercel project settings:
   - `DATABASE_URL`: Your Postgres connection string
   - `AUTH_SECRET`: `openssl rand -base64 32`
   - `GOOGLE_PLACES_API_KEY`: Your Google Places API key
   - `CRON_SECRET`: `openssl rand -base64 32` (authenticates cron endpoints)
   - `RESEND_API_KEY`: From [resend.com](https://resend.com) (required for price drop email alerts)
   - `RESEND_FROM_EMAIL`: Verified sender address on Resend
4. Add build command override: `npx prisma generate && next build`
5. After the first deploy, run the following via a local connection to the production DB:
   ```bash
   npm run db:deploy  # Apply migrations
   npm run db:seed    # Create the admin user
   ```

## Price Watch

### Cron Schedule (GitHub Actions)

Price watches run daily at **6am UTC** via GitHub Actions (`.github/workflows/refresh-price-watches.yml`). This runs outside Vercel because the Playwright-based scrapers require a full Linux environment with a virtual display.

Add these secrets to your GitHub repository (**Settings → Secrets → Actions**):

| Secret              | Value                                      |
| ------------------- | ------------------------------------------ |
| `DATABASE_URL`      | Your production Postgres connection string |
| `RESEND_API_KEY`    | Your Resend API key                        |
| `RESEND_FROM_EMAIL` | Your verified Resend sender email          |

To run manually:

```bash
npm run prices:refresh
# or trigger on GitHub Actions:
./scripts/trigger-price-refresh.sh
```

## Managing Users

Self-registration is closed. New users can be created via `POST /api/auth/register`. Admin users can write to reference data (hotel chains, credit cards, portals); regular users manage their own bookings and promotions.

To promote a user to admin:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'user@example.com';
```
