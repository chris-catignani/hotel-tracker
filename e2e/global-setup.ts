import { execSync } from "child_process";
import { FullConfig } from "@playwright/test";

async function globalSetup(_config: FullConfig) {
  console.log("Global Setup: Synchronizing test database...");

  const testDbUrl = process.env.DATABASE_URL_TEST;

  if (!testDbUrl) {
    throw new Error("DATABASE_URL_TEST must be set for E2E tests.");
  }

  // Ensure the database is fresh and seeded
  try {
    // pg_trgm must exist before db push so Prisma can create the GIN trgm index declared in the schema
    const extensionOutput = execSync(
      "npx prisma db execute --stdin --schema prisma/schema.prisma",
      {
        input: "CREATE EXTENSION IF NOT EXISTS pg_trgm;\n",
        stdio: "pipe",
        env: {
          ...process.env,
          DATABASE_URL: testDbUrl,
          PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes, i consent to prisma dangerous actions",
        },
      }
    );
    console.log(extensionOutput.toString());

    const pushOutput = execSync("npx prisma db push --force-reset --accept-data-loss", {
      stdio: "pipe",
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes, i consent to prisma dangerous actions",
      },
    });
    console.log(pushOutput.toString());

    const seedOutput = execSync("npm run db:seed:e2e", {
      stdio: "pipe",
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes, i consent to prisma dangerous actions",
      },
    });
    console.log(seedOutput.toString());
    console.log("Global Setup: Database ready.");
  } catch (error) {
    console.error("Global Setup: Failed to setup database", error);
    throw error;
  }
}

export default globalSetup;
