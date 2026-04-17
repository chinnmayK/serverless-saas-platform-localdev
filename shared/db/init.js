const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

async function runMigrationsIfNeeded() {
  if (process.env.RUN_DB_MIGRATIONS !== "true") return;

  const migrationId = "init-v5";
  let adminPool;

  try {
    // 1. Determine Administrative Connection
    // We MUST use a dedicated admin pool to avoid the bootstrap deadlock 
    // where we can't create app_user because we're trying to connect as app_user.
    const adminUrl = process.env.DB_ADMIN_URL;
    const masterPassword = process.env.DB_PASSWORD;
    const dbHost = process.env.DB_HOST || "localhost";
    const dbName = process.env.DB_NAME || "saas_db";

    const isRDS = !!(adminUrl && adminUrl.includes("amazonaws.com")) || !!(dbHost && dbHost.includes("amazonaws.com"));
    const sslConfig = isRDS ? { rejectUnauthorized: false } : false;

    if (adminUrl) {
      logger.info("db.migration.using_admin_url", { migrationId });
      adminPool = new Pool({ 
        connectionString: adminUrl,
        ssl: sslConfig
      });
    } else if (masterPassword) {
      // Emergency Fallback: If DB_ADMIN_URL is missing, try master user 'dbadmin' or 'app_user' with the master password.
      logger.warn("db.migration.admin_url_missing_trying_master_password", { migrationId });
      adminPool = new Pool({
        host: dbHost,
        database: dbName,
        user: "dbadmin", // Try the new master username first
        password: masterPassword,
        ssl: sslConfig
      });
    } else {
      logger.error("db.migration.no_admin_credentials_available", { migrationId });
      return;
    }

    // 2. Initial Connection Check
    const client = await adminPool.connect();
    try {
      // Check if migration already applied
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id VARCHAR(100) PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);

      const res = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [migrationId]);
      if (res.rows.length > 0) {
        logger.info("db.migration.already_applied", { migrationId });
        return;
      }

      logger.info(`🚀 Running migration ${migrationId}...`);

      // 3. Load SQL Script
      let sql;
      const pathsToTry = [
        path.join(__dirname, "../../init-db.sql"),  // Workspace relative
        path.join(process.cwd(), "init-db.sql"),     // Docker workdir
        "/app/init-db.sql"                          // Absolute standard
      ];

      for (const p of pathsToTry) {
        try {
          sql = fs.readFileSync(p, "utf8");
          logger.info("db.migration.sql_loaded", { path: p });
          break;
        } catch (e) {}
      }

      if (!sql) throw new Error("Could not find init-db.sql in any expected location");

      // 4. Bulk Execution
      await client.query(sql);

      // 5. Record Success
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migrationId]);
      logger.info("db.migration.success", { migrationId });

    } finally {
      client.release();
    }
  } catch (err) {
    logger.error("db.migration.critical_failure", { 
      migrationId, 
      error: err.message,
      code: err.code 
    });
    // Rethrow to stop startup if migrations are required and failing
    throw err;
  } finally {
    if (adminPool) await adminPool.end();
  }
}

module.exports = { runMigrationsIfNeeded };
