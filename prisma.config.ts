import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved the datasource connection URL out of `schema.prisma`.
 * The CLI (migrate / db pull / studio) reads it from here; the runtime
 * `PrismaClient` gets its connection through the driver adapter in
 * `src/lib/prisma.ts`.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
