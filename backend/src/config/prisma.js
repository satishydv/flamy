import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export { prisma, pool };
export default prisma;
