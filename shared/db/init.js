const fs = require("fs");
const path = require("path");
const { pool } = require("../utils/db");

async function runMigrations() {
  try {
    const filePath = path.join(__dirname, "init-db.sql");
    const sql = fs.readFileSync(filePath, "utf8");

    await pool.query(sql);

    console.log("✅ DB initialized");
  } catch (err) {
    console.error("❌ DB init failed:", err.message);
    throw err;
  }
}

async function runMigrationsIfNeeded() {
  if (process.env.RUN_DB_MIGRATIONS !== "true") {
    return;
  }

  await runMigrations();
}

module.exports = { runMigrations, runMigrationsIfNeeded };
