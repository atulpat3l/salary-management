import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';

/** The single Prisma client for the process (SQLite via the libsql driver adapter). */
export const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: env.DATABASE_URL }),
});
