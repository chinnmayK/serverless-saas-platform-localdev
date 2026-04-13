const { Client } = require("pg");

async function run() {
  const client = new Client({
    connectionString: "postgres://saas_user:saas_password@localhost:5432/saas_db"
  });

  try {
    await client.connect();
    console.log("Connected to database. Running schema migration for legacy `id` -> `tenant_id`...");
    
    await client.query(`
      DO $$ 
      BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='id') THEN
              ALTER TABLE tenants RENAME COLUMN id TO tenant_id;
              RAISE NOTICE 'Renamed id to tenant_id on tenants table';
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='id') THEN
              ALTER TABLE users RENAME COLUMN id TO user_id;
              RAISE NOTICE 'Renamed id to user_id on users table';
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='files' AND column_name='id') THEN
              ALTER TABLE files RENAME COLUMN id TO file_id;
              RAISE NOTICE 'Renamed id to file_id on files table';
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='id') THEN
              ALTER TABLE subscriptions RENAME COLUMN id TO subscription_id;
              RAISE NOTICE 'Renamed id to subscription_id on subscriptions table';
          END IF;
      END $$;
    `);

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
