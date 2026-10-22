import { bulkInsert } from '../../src/lib/bulkInsert';
import { prisma, resetDb } from '../helpers/db';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('bulkInsert', () => {
  it('inserts rows that Prisma reads back with the right types (decimals, booleans, defaults)', async () => {
    const run = await prisma.payrollRun.create({ data: { month: '2026-10' } });
    await prisma.country.create({
      data: { code: 'US', name: 'United States', currencyCode: 'USD', locale: 'en-US' },
    });
    const structure = await prisma.salaryStructure.create({
      data: {
        name: 'S',
        style: 'STANDARD',
        countryCode: 'US',
        variableTargetPct: '10',
        standardMonthlyHours: 160,
        overtimeMultiplier: '1.5',
      },
    });
    const employee = await prisma.employee.create({
      data: {
        employeeCode: 'EMP00001',
        fullName: 'Asha Rao',
        jobTitle: 'Engineer',
        countryCode: 'US',
        annualBaseSalary: '60000',
        structureId: structure.id,
      },
    });

    await prisma.$transaction((tx) =>
      bulkInsert(tx, 'Payslip', [
        {
          runId: run.id,
          employeeId: employee.id,
          employeeCode: 'EMP00001',
          fullName: "Asha O'Rao", // quotes are data, not SQL
          jobTitle: 'Engineer',
          countryCode: 'US',
          countryName: 'United States',
          currency: 'USD',
          structureName: 'S',
          annualBaseSalary: '60000.00',
          overtimeHours: '10.5',
          bonus: '1000.00',
          achievementPct: '80',
          gross: '9068.75',
          totalDeductions: '2163.75',
          net: '-0.01',
          flagged: true,
        },
      ]),
    );

    const saved = await prisma.payslip.findFirstOrThrow();
    expect(saved.fullName).toBe("Asha O'Rao");
    expect(saved.gross.toFixed(2)).toBe('9068.75');
    expect(saved.overtimeHours.toString()).toBe('10.5');
    expect(saved.net.toFixed(2)).toBe('-0.01');
    expect(saved.flagged).toBe(true);
    expect(saved.createdAt).toBeInstanceOf(Date);
  });

  it('splits large inputs across several statements', async () => {
    const rows = Array.from({ length: 12_000 }, (_, i) => ({
      code: `C${i}`.slice(0, 2).padEnd(2, 'X') + String(i), // unique primary keys
      name: `Country ${i}`,
      currencyCode: 'XXX',
      locale: 'en-US',
    }));

    await prisma.$transaction((tx) => bulkInsert(tx, 'Country', rows), { timeout: 60_000 });

    expect(await prisma.country.count()).toBe(12_000);
  });

  it('does nothing for an empty list', async () => {
    await prisma.$transaction((tx) => bulkInsert(tx, 'Country', []));
    expect(await prisma.country.count()).toBe(0);
  });

  it('refuses unsafe table or column names', async () => {
    await expect(
      prisma.$transaction((tx) => bulkInsert(tx, 'Country"; DROP TABLE "Employee', [{ a: 1 }])),
    ).rejects.toThrow(/Unsafe SQL identifier/);
    await expect(
      prisma.$transaction((tx) => bulkInsert(tx, 'Country', [{ 'code) --': 'x' }])),
    ).rejects.toThrow(/Unsafe SQL identifier/);
  });
});
