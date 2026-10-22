import type { Prisma } from '../generated/prisma/client';

/**
 * SQLite allows up to 32,766 bound parameters per statement; stay well inside it.
 */
const MAX_PARAMETERS_PER_STATEMENT = 30_000;
const SAFE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

type SqlValue = string | number | boolean | null;

/**
 * Inserts many rows with multi-row INSERT statements.
 *
 * Why not `createMany`? Through Prisma's SQLite driver adapters (measured with both libsql and
 * better-sqlite3) it inserts roughly one row at a time: ~67k payslip lines took 81 s that way,
 * while a whole 10,000-employee payroll (10k payslips + ~70k lines) takes ~3 s with this.
 * That is what keeps NFR-02 (under one minute) achievable.
 *
 * Values are always bound parameters. Table and column names come from our own code and are
 * still checked, so this can never be used to inject SQL.
 */
export async function bulkInsert(
  tx: Prisma.TransactionClient,
  table: string,
  rows: Record<string, SqlValue>[],
): Promise<void> {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);
  for (const identifier of [table, ...columns]) {
    if (!SAFE_IDENTIFIER.test(identifier)) throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  const rowsPerStatement = Math.max(1, Math.floor(MAX_PARAMETERS_PER_STATEMENT / columns.length));
  const columnList = columns.map((column) => `"${column}"`).join(', ');
  const placeholders = `(${columns.map(() => '?').join(', ')})`;

  for (let start = 0; start < rows.length; start += rowsPerStatement) {
    const chunk = rows.slice(start, start + rowsPerStatement);
    const values = chunk.flatMap((row) =>
      columns.map((column) => {
        const value = row[column];
        // SQLite stores booleans as 0/1, as Prisma does.
        return typeof value === 'boolean' ? Number(value) : value;
      }),
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "${table}" (${columnList}) VALUES ${chunk.map(() => placeholders).join(', ')}`,
      ...values,
    );
  }
}
