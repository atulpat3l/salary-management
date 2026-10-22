import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';

/** The single Prisma client for the process (SQLite via the better-sqlite3 driver adapter). */
export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: env.DATABASE_URL }),
});
