import request from 'supertest';
import {
  DEMO_EMPLOYEE_PASSWORD,
  DEMO_EMPLOYEES,
  seedDemoData,
} from '../../prisma/seed/seedDemoData';
import { seedReferenceData } from '../../prisma/seed/seedReferenceData';
import { createApp } from '../../src/app';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createHrAccount } from '../helpers/factories';

const app = createApp();
// Small and fixed, so the test is fast and does not depend on today's date.
const OPTIONS = { employeeCount: 120, payrollMonths: 2, today: new Date('2026-10-15T00:00:00Z') };

/** Everything that identifies the generated data, for comparing two runs. */
async function snapshot() {
  const employees = await prisma.employee.findMany({ orderBy: { id: 'asc' } });
  const payslips = await prisma.payslip.findMany({
    orderBy: [{ runId: 'asc' }, { employeeId: 'asc' }],
  });
  return {
    employees: employees.map((e) => [
      e.employeeCode,
      e.fullName,
      e.jobTitle,
      e.countryCode,
      e.annualBaseSalary.toString(),
      e.status,
    ]),
    payslips: payslips.map((p) => [p.employeeCode, p.net.toString()]),
  };
}

beforeAll(async () => {
  await resetDb();
  await seedReferenceData();
}, 60_000);
afterAll(() => prisma.$disconnect());

describe('FR-DATA-01: demo data seed', () => {
  let result: Awaited<ReturnType<typeof seedDemoData>>;
  beforeAll(async () => {
    result = await seedDemoData(OPTIONS);
  }, 60_000);

  it('creates the requested number of employees, each with a login', async () => {
    expect(result.employees).toBe(120);
    expect(await prisma.employee.count()).toBe(120);
    expect(await prisma.account.count({ where: { role: 'EMPLOYEE' } })).toBe(120);
  });

  it('gives sequential Employee IDs, with the demo employees first', async () => {
    const first = await prisma.employee.findMany({ orderBy: { id: 'asc' }, take: 4 });
    expect(first.map((e) => [e.employeeCode, e.fullName])).toEqual(
      DEMO_EMPLOYEES.map((demo, i) => [`EMP0000${i + 1}`, demo.fullName]),
    );
  });

  it('spreads employees across every supported country, each on a structure of its own country', async () => {
    const countries = await prisma.employee.groupBy({ by: ['countryCode'], _count: true });
    expect(countries.map((c) => c.countryCode).sort()).toEqual([
      'AU',
      'CA',
      'DE',
      'GB',
      'IN',
      'US',
    ]);

    const employees = await prisma.employee.findMany({ include: { structure: true } });
    expect(employees.every((e) => e.structure.countryCode === e.countryCode)).toBe(true);
  });

  it('gives realistic, valid salaries: positive and at most two decimals', async () => {
    const employees = await prisma.employee.findMany();
    for (const e of employees) {
      expect(e.annualBaseSalary.gt(0)).toBe(true);
      expect(e.annualBaseSalary.decimalPlaces()).toBeLessThanOrEqual(2);
    }
    const india = employees.filter((e) => e.countryCode === 'IN' && e.id > 4);
    const us = employees.filter((e) => e.countryCode === 'US' && e.id > 4);
    // INR salaries are in lakhs, USD in tens of thousands.
    expect(india.every((e) => e.annualBaseSalary.gte(100_000))).toBe(true);
    expect(us.every((e) => e.annualBaseSalary.lt(500_000))).toBe(true);
  });

  it('includes some inactive employees, who are not paid', async () => {
    const inactive = await prisma.employee.count({ where: { status: 'INACTIVE' } });
    expect(result.active).toBe(120 - inactive);
    expect(await prisma.payslip.count({ where: { employee: { status: 'INACTIVE' } } })).toBe(0);
  });

  it('creates finalised and paid payroll for the past months, with no flagged employees', async () => {
    expect(result.payrollMonths).toEqual(['2026-08', '2026-09']);
    const runs = await prisma.payrollRun.findMany({ orderBy: { month: 'asc' } });
    expect(runs.map((r) => [r.month, r.status, r.paymentDate?.toISOString().slice(0, 10)])).toEqual(
      [
        ['2026-08', 'DISBURSED', '2026-08-31'],
        ['2026-09', 'DISBURSED', '2026-09-30'],
      ],
    );
    expect(await prisma.payslip.count()).toBe(result.active * 2);
    expect(await prisma.payslip.count({ where: { flagged: true } })).toBe(0);
    expect(await prisma.payrollInput.count()).toBeGreaterThan(0);
  });

  it('documented demo employees can log in and see their payslip history', async () => {
    for (let i = 0; i < DEMO_EMPLOYEES.length; i++) {
      const token = await loginAs(app, `EMP0000${i + 1}`, DEMO_EMPLOYEE_PASSWORD);
      const payslips = (await request(app).get('/api/me/payslips').set(bearer(token))).body;
      expect(
        payslips.map((p: { month: string; paymentStatus: string }) => [p.month, p.paymentStatus]),
      ).toEqual([
        ['2026-09', 'PAID'],
        ['2026-08', 'PAID'],
      ]);
    }
  });

  it('the demo US employee is the PRD example: net USD 5,810.00 a month', async () => {
    const token = await loginAs(app, 'EMP00001', DEMO_EMPLOYEE_PASSWORD);
    const [latest] = (await request(app).get('/api/me/payslips').set(bearer(token))).body;
    expect(latest.net).toEqual({ amount: '5810.00', currency: 'USD' });
  });

  it('other employees cannot log in with the demo password, and must set their own', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'EMP00050', password: DEMO_EMPLOYEE_PASSWORD });
    expect(res.status).toBe(401);
    const account = await prisma.account.findUniqueOrThrow({ where: { loginId: 'EMP00050' } });
    expect(account.mustChangePassword).toBe(true);
  });

  it('is deterministic and repeatable: running it again gives exactly the same data', async () => {
    const before = await snapshot();
    const { account, password } = await createHrAccount();

    await seedDemoData(OPTIONS);

    expect(await snapshot()).toEqual(before);
    expect(await prisma.employee.count()).toBe(120); // no duplicates
    // HR logins survive a re-seed.
    await expect(loginAs(app, account.loginId, password)).resolves.toEqual(expect.any(String));
  }, 60_000);
});
