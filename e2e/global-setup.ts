import { execSync } from "child_process";
import { FullConfig } from "@playwright/test";

async function globalSetup(_config: FullConfig) {
  console.log("Global Setup: Synchronizing test database...");

  const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

  if (!testDbUrl) {
    throw new Error("DATABASE_URL or DATABASE_URL_TEST must be set for E2E tests.");
  }

  // Ensure the database is fresh and seeded
  try {
    execSync("npx prisma db push --force-reset", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: testDbUrl },
    });
    execSync("npx prisma db seed", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: testDbUrl },
    });
    console.log("Global Setup: Database ready.");
  } catch (error) {
    console.error("Global Setup: Failed to setup database", error);
    throw error;
  }
}

export default globalSetup;
