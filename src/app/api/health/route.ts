import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Liveness + DB readiness probe. Never cached.
 * Returns 200 only when the app can reach Postgres.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "down",
        message: error instanceof Error ? error.message : "unknown error",
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
