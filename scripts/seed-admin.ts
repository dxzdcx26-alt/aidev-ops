/**
 * Seed script — creates default admin user if none exists.
 *
 * Usage: CONTROL_CENTER_ADMIN_PASSWORD=yourpass bun run scripts/seed-admin.ts
 *
 * If CONTROL_CENTER_ADMIN_PASSWORD is not set, a random password is generated
 * and printed to stderr.
 */

import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

async function main() {
  const count = await db.user.count();
  if (count > 0) {
    console.log(`Users already exist (${count}). Skipping seed.`);
    return;
  }
  const password = process.env.CONTROL_CENTER_ADMIN_PASSWORD || randomBytes(12).toString("hex");
  const user = await db.user.create({
    data: {
      username: "admin",
      passwordHash: hashPassword(password),
      role: "admin",
    },
  });
  console.log("=".repeat(60));
  console.log("DEFAULT ADMIN USER CREATED");
  console.log(`  ID: ${user.id}`);
  console.log(`  Username: admin`);
  console.log(`  Password: ${password}`);
  console.log(`  Role: admin`);
  if (!process.env.CONTROL_CENTER_ADMIN_PASSWORD) {
    console.log("  (Set CONTROL_CENTER_ADMIN_PASSWORD env var to override)");
  }
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
