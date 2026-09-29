import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.VERCEL
    ? "file:/tmp/adcc.db"
    : "file:./db/adcc.db";
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  schemaReady: Promise<void> | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token")`,
  `CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId")`,
  `CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt")`,
  `CREATE TABLE IF NOT EXISTS "ApprovalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "repository" TEXT,
    "pullRequest" INTEGER,
    "commitSha" TEXT,
    "actorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "ApprovalRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ApprovalRecord_action_target_status_idx" ON "ApprovalRecord"("action", "target", "status")`,
  `CREATE INDEX IF NOT EXISTS "ApprovalRecord_actorId_idx" ON "ApprovalRecord"("actorId")`,
  `CREATE INDEX IF NOT EXISTS "ApprovalRecord_expiresAt_idx" ON "ApprovalRecord"("expiresAt")`,
  `CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "repository" TEXT,
    "commitSha" TEXT,
    "requestId" TEXT,
    "result" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "ip" TEXT,
    CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "AuditEvent_action_idx" ON "AuditEvent"("action")`,
  `CREATE INDEX IF NOT EXISTS "AuditEvent_actorId_idx" ON "AuditEvent"("actorId")`,
  `CREATE INDEX IF NOT EXISTS "AuditEvent_timestamp_idx" ON "AuditEvent"("timestamp")`,
  `CREATE INDEX IF NOT EXISTS "AuditEvent_result_idx" ON "AuditEvent"("result")`,
];

export async function ensureDatabase(): Promise<void> {
  if (!globalForPrisma.schemaReady) {
    globalForPrisma.schemaReady = (async () => {
      for (const sql of SCHEMA_SQL) {
        await db.$executeRawUnsafe(sql);
      }
    })();
  }
  await globalForPrisma.schemaReady;
}
