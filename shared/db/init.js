const fs = require("fs");
const path = require("path");
const { pool } = require("../utils/db");

async function runMigrationsIfNeeded() {
  if (process.env.RUN_DB_MIGRATIONS !== "true") return;

  const migrationId = "init-v1";

  // Ensure lock table exists before checking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const result = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE id = $1",
    [migrationId]
  );

  if (result.rowCount > 0) {
    console.log("⏭️ Migration already applied");
    return;
  }

  const filePath = path.join(__dirname, "init-db.sql");
  const sql = fs.readFileSync(filePath, "utf8");

  await pool.query(sql);

  await pool.query(
    "INSERT INTO schema_migrations (id) VALUES ($1)",
    [migrationId]
  );

  console.log("✅ DB initialized (once)");
}

module.exports = { runMigrationsIfNeeded };
