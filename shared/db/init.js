const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { pool: defaultPool } = require("../utils/db");

async function runMigrationsIfNeeded() {
  if (process.env.RUN_DB_MIGRATIONS !== "true") return;

  const migrationId = "init-v5"; // Bumped version for robust statement-by-statement execution
  let adminPool;

  try {
    // 🔥 Use Admin Pool if available, else fallback to default
    if (process.env.DB_ADMIN_URL) {
      console.log("🛠️ Using Admin Pool for migrations...");
      adminPool = new Pool({ connectionString: process.env.DB_ADMIN_URL });
    }

    const migrationClient = adminPool || defaultPool;

    // 1. Setup Migration Table
    await migrationClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Check Migration History
    const result = await migrationClient.query(
      "SELECT 1 FROM schema_migrations WHERE id = $1",
      [migrationId]
    );

    if (result.rowCount > 0) {
      console.log(`⏭️ Migration ${migrationId} already applied`);
      return;
    }

    console.log(`🚀 Running migration ${migrationId}...`);

    // In our case, the file is in the root of the workspace.
    // If this runs in api-gateway, init-db.sql should be copied there or reachable.
    let sql;
    try {
        // Local dev / Workspace relative path
        const localPath = path.join(__dirname, "../../init-db.sql");
        sql = fs.readFileSync(localPath, "utf8");
    } catch (e) {
        try {
            // Docker / production path (relative to service root)
            sql = fs.readFileSync(path.join(process.cwd(), "init-db.sql"), "utf8");
        } catch (e2) {
            // Absolute fallback for standard Docker containers
            sql = fs.readFileSync("/app/init-db.sql", "utf8");
        }
    }

    // 3. Execute the SQL script (bulk execution is safe for idempotent scripts)
    await migrationClient.query(sql);

    // 4. Record success
    await migrationClient.query(
      "INSERT INTO schema_migrations (id) VALUES ($1)",
      [migrationId]
    );

    console.log(`✅ DB Migration ${migrationId} applied successfully.`);
  } catch (err) {
    console.error(`❌ Migration ${migrationId} CRITICAL FAILURE:`, err.message);
    throw err;
  } finally {
    if (adminPool) await adminPool.end();
  }
}

module.exports = { runMigrationsIfNeeded };
