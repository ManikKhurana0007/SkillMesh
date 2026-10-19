import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to repair the team invitation schema.");
}

const repairFiles = [
  new URL("../prisma/repairs/challenge-features.sql", import.meta.url),
  new URL("../prisma/repairs/team-invitations.sql", import.meta.url),
  new URL("../prisma/repairs/teamforge-features.sql", import.meta.url),
  new URL("../prisma/repairs/profile-features.sql", import.meta.url),
  new URL("../prisma/repairs/planner-features.sql", import.meta.url),
];
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  for (const repairFile of repairFiles) {
    const sql = await readFile(fileURLToPath(repairFile), "utf8");
    await pool.query(sql);
  }
  console.log("Challenge, team, TeamForge, profile, practice, quiz, and notification schema is ready.");
} catch (error) {
  console.error("Could not repair the application schema:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
