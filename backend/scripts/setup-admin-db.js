import { pool } from "../src/config/prisma.js";
import { ensureSuperAdmin } from "../src/controllers/admin.controller.js";

async function setupAdminTables() {
  console.log("Setting up Admin User and Admin Session tables in PostgreSQL...");
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "admin_user" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'superadmin',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "avatar" TEXT,
        "lastLogin" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_email_key" ON "admin_user"("email");

      CREATE TABLE IF NOT EXISTS "admin_session" (
        "id" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "adminId" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "admin_session_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "admin_session_token_key" ON "admin_session"("token");
      CREATE INDEX IF NOT EXISTS "admin_session_adminId_idx" ON "admin_session"("adminId");
    `);

    // Add constraint safely if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'admin_session_adminId_fkey'
        ) THEN
          ALTER TABLE "admin_session" 
          ADD CONSTRAINT "admin_session_adminId_fkey" 
          FOREIGN KEY ("adminId") REFERENCES "admin_user"("id") 
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    console.log("✅ Admin tables verified/created successfully.");

    await ensureSuperAdmin();
    console.log("✅ Super Admin check completed.");
  } catch (error) {
    console.error("❌ Error setting up admin tables:", error);
  } finally {
    client.release();
    process.exit(0);
  }
}

setupAdminTables();
