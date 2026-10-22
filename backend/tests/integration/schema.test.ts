import { prisma, resetDb } from '../helpers/db';

/** Creates a country with one structure and returns the structure id. */
async function createUsStructure() {
  await prisma.country.create({
    data: { code: 'US', name: 'United States', currencyCode: 'USD', locale: 'en-US' },
  });
  const structure = await prisma.salaryStructure.create({
    data: {
      name: 'US Standard',
      style: 'STANDARD',
      countryCode: 'US',
      variableTargetPct: '10',
      standardMonthlyHours: 160,
      overtimeMultiplier: '1.5',
    },
  });
  return structure.id;
}

function employeeData(structureId: number, employeeCode: string) {
  return {
    employeeCode,
    fullName: 'Asha Rao',
    jobTitle: 'Engineer',
    countryCode: 'US',
    annualBaseSalary: '60000.00',
    structureId,
  };
}

describe('database schema', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('stores money as an exact Decimal (no floating-point drift) — NFR-03', async () => {
    const structureId = await createUsStructure();
    await prisma.employee.create({
      data: { ...employeeData(structureId, 'EMP00001'), annualBaseSalary: '12345678.91' },
    });

    const saved = await prisma.employee.findUniqueOrThrow({ where: { employeeCode: 'EMP00001' } });
    expect(saved.annualBaseSalary.toFixed(2)).toBe('12345678.91');
    expect(saved.annualBaseSalary.plus('0.09').toFixed(2)).toBe('12345679.00');
  });

  it('defaults a new employee to ACTIVE with timestamps', async () => {
    const structureId = await createUsStructure();
    const employee = await prisma.employee.create({ data: employeeData(structureId, 'EMP00001') });
    expect(employee.status).toBe('ACTIVE');
    expect(employee.createdAt).toBeInstanceOf(Date);
  });

  it('rejects a duplicate Employee ID — A10', async () => {
    const structureId = await createUsStructure();
    await prisma.employee.create({ data: employeeData(structureId, 'EMP00001') });
    await expect(
      prisma.employee.create({ data: employeeData(structureId, 'EMP00001') }),
    ).rejects.toThrow();
  });

  it('allows two employees with the same name — FR-EMP-05 / A10', async () => {
    const structureId = await createUsStructure();
    await prisma.employee.create({ data: employeeData(structureId, 'EMP00001') });
    await prisma.employee.create({ data: employeeData(structureId, 'EMP00002') });
    expect(await prisma.employee.count({ where: { fullName: 'Asha Rao' } })).toBe(2);
  });

  it('rejects an employee whose country does not exist', async () => {
    const structureId = await createUsStructure();
    await expect(
      prisma.employee.create({
        data: { ...employeeData(structureId, 'EMP00001'), countryCode: 'XX' },
      }),
    ).rejects.toThrow();
  });

  it('rejects a duplicate login ID and links at most one account per employee', async () => {
    const structureId = await createUsStructure();
    const employee = await prisma.employee.create({ data: employeeData(structureId, 'EMP00001') });
    await prisma.account.create({
      data: { loginId: 'EMP00001', passwordHash: 'h', role: 'EMPLOYEE', employeeId: employee.id },
    });

    await expect(
      prisma.account.create({ data: { loginId: 'EMP00001', passwordHash: 'h', role: 'HR' } }),
    ).rejects.toThrow();
    await expect(
      prisma.account.create({
        data: { loginId: 'OTHER', passwordHash: 'h', role: 'EMPLOYEE', employeeId: employee.id },
      }),
    ).rejects.toThrow();
  });

  it('new accounts must change their password by default — FR-AUTH-04', async () => {
    const account = await prisma.account.create({
      data: { loginId: 'HR001', passwordHash: 'h', role: 'HR' },
    });
    expect(account.mustChangePassword).toBe(true);
    expect(account.employeeId).toBeNull();
  });

  it('deletes an account’s sessions together with the account', async () => {
    const account = await prisma.account.create({
      data: { loginId: 'HR001', passwordHash: 'h', role: 'HR' },
    });
    const session = await prisma.session.create({ data: { accountId: account.id } });
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);

    await prisma.account.delete({ where: { id: account.id } });
    expect(await prisma.session.count()).toBe(0);
  });

  it('keeps structure components in order and unique by name within a structure — FR-STR-01', async () => {
    const structureId = await createUsStructure();
    await prisma.structureComponent.createMany({
      data: [
        {
          structureId,
          kind: 'DEDUCTION',
          name: 'Income tax',
          basis: 'PCT_GROSS',
          value: '20',
          sortOrder: 2,
        },
        {
          structureId,
          kind: 'EARNING',
          name: 'Housing allowance',
          basis: 'PCT_BASE',
          value: '40',
          sortOrder: 1,
        },
      ],
    });

    const structure = await prisma.salaryStructure.findUniqueOrThrow({
      where: { id: structureId },
      include: { components: { orderBy: { sortOrder: 'asc' } }, country: true },
    });
    expect(structure.country.currencyCode).toBe('USD');
    expect(structure.components.map((c) => c.name)).toEqual(['Housing allowance', 'Income tax']);

    await expect(
      prisma.structureComponent.create({
        data: {
          structureId,
          kind: 'EARNING',
          name: 'Housing allowance',
          basis: 'FIXED',
          value: '1',
          sortOrder: 3,
        },
      }),
    ).rejects.toThrow();
  });
});
