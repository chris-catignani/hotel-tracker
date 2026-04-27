import * as dotenv from "dotenv";
// Capture before dotenv runs so callers (e.g. E2E test runner) can override .env.local
const callerDatabaseUrl = process.env.DATABASE_URL;
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
if (callerDatabaseUrl) process.env.DATABASE_URL = callerDatabaseUrl;
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
  },
});
