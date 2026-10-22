import request from 'supertest';
import { seedReferenceData } from '../../prisma/seed/seedReferenceData';
import { createApp } from '../../src/app';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createEmployeeAccount, createHrAccount } from '../helpers/factories';

const app = createApp();
let hrToken: string;

let codeSequence = 0;
async function addEmployee(
  structureName: string,
  annualBaseSalary: string,
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
) {
  const structure = await prisma.salaryStructure.findUniqueOrThrow({
    where: { name: structureName },
  });
  return prisma.employee.create({
    data: {
      employeeCode: `EMP${String(++codeSequence).padStart(5, '0')}`,
      fullName: `Employee ${codeSequence}`,
      jobTitle: 'Engineer',
      countryCode: structure.countryCode,
      annualBaseSalary,
      structureId: structure.id,
      status,
    },
  });
}

const api = {
  createRun: async (month = '2026-10') =>
    (await request(app).post('/api/payroll-runs').set(bearer(hrToken)).send({ month })).body as {
      id: number;
    },
  saveInputs: (runId: number, inputs: object[]) =>
    request(app).put(`/api/payroll-runs/${runId}/inputs`).set(bearer(hrToken)).send({ inputs }),
  calculate: (runId: number) =>
    request(app).post(`/api/payroll-runs/${runId}/calculate`).set(bearer(hrToken)),
  payslips: (runId: number, query: Record<string, string | number> = {}) =>
    request(app).get(`/api/payroll-runs/${runId}/payslips`).query(query).set(bearer(hrToken)),
  payslip: (runId: number, payslipId: number) =>
    request(app).get(`/api/payroll-runs/${runId}/payslips/${payslipId}`).set(bearer(hrToken)),
};

const netOf = async (runId: number, employeeId: number) =>
  (
    await prisma.payslip.findUniqueOrThrow({
      where: { runId_employeeId: { runId, employeeId } },
    })
  ).net.toFixed(2);

beforeEach(async () => {
  await resetDb();
  await seedReferenceData();
  const { account, password } = await createHrAccount();
  hrToken = await loginAs(app, account.loginId, password);
});
afterAll(() => prisma.$disconnect());

describe('POST /api/payroll-runs/:id/calculate — FR-PAY-02', () => {
  it('calculates every active employee separately, with their own inputs (PRD worked examples)', async () => {
    const withInputs = await addEmployee('US Standard', '60000');
    const withoutInputs = await addEmployee('US Standard', '60000');
    const run = await api.createRun();
    await api.saveInputs(run.id, [
      { employeeId: withInputs.id, overtimeHours: 10, bonus: 1000, achievementPct: 80 },
    ]);

    const res = await api.calculate(run.id);

    expect(res.status).toBe(200);
    expect(await netOf(run.id, withInputs.id)).toBe('6905.00'); // worked example 1
    expect(await netOf(run.id, withoutInputs.id)).toBe('5810.00'); // = standard monthly salary
  });

  it('pays employees with no inputs exactly their standard monthly salary', async () => {
    const employee = await addEmployee('IN Sales', '1234567.89');
    const run = await api.createRun();
    await api.calculate(run.id);

    const standard = await request(app).get(`/api/employees/${employee.id}`).set(bearer(hrToken));
    expect(await netOf(run.id, employee.id)).toBe(standard.body.standardMonthlySalary.net.amount);
  });

  it('excludes inactive employees, even if they have inputs', async () => {
    const active = await addEmployee('US Standard', '60000');
    const leaver = await addEmployee('US Standard', '60000');
    const run = await api.createRun();
    await api.saveInputs(run.id, [{ employeeId: leaver.id, bonus: 500 }]);
    await prisma.employee.update({ where: { id: leaver.id }, data: { status: 'INACTIVE' } });

    await api.calculate(run.id);

    const payslips = await prisma.payslip.findMany({ where: { runId: run.id } });
    expect(payslips.map((p) => p.employeeId)).toEqual([active.id]);
  });

  it('records the time of the calculation', async () => {
    await addEmployee('US Standard', '60000');
    const run = await api.createRun();
    const res = await api.calculate(run.id);
    expect(new Date(res.body.calculatedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('can recalculate a draft: results follow changed inputs and employee details, without duplicates', async () => {
    const employee = await addEmployee('US Standard', '60000');
    const run = await api.createRun();
    await api.calculate(run.id);
    expect(await netOf(run.id, employee.id)).toBe('5810.00');

    await api.saveInputs(run.id, [
      { employeeId: employee.id, overtimeHours: 10, bonus: 1000, achievementPct: 80 },
    ]);
    await api.calculate(run.id);
    expect(await netOf(run.id, employee.id)).toBe('6905.00');

    await prisma.employee.update({
      where: { id: employee.id },
      data: { annualBaseSalary: '120000' },
    });
    await api.calculate(run.id);
    expect(Number(await netOf(run.id, employee.id))).toBeGreaterThan(6905);

    expect(await prisma.payslip.count({ where: { runId: run.id } })).toBe(1);
    expect(await prisma.payslipLine.count()).toBe(9);
  });

  it('flags an employee whose deductions exceed gross pay', async () => {
    await prisma.salaryStructure.create({
      data: {
        name: 'US Heavy Loan',
        style: 'STANDARD',
        countryCode: 'US',
        variableTargetPct: '0',
        standardMonthlyHours: 160,
        overtimeMultiplier: '1.5',
        components: {
          create: [
            { kind: 'DEDUCTION', name: 'Loan', basis: 'FIXED', value: '9000', sortOrder: 1 },
          ],
        },
      },
    });
    const flagged = await addEmployee('US Heavy Loan', '60000');
    await addEmployee('US Standard', '60000');
    const run = await api.createRun();

    const res = await api.calculate(run.id);

    expect(res.body.summary.flaggedCount).toBe(1);
    const list = await api.payslips(run.id, { flagged: 'true' });
    expect(list.body.items.map((p: { employeeId: number }) => p.employeeId)).toEqual([flagged.id]);
    expect(list.body.items[0].net).toEqual({ amount: '-4000.00', currency: 'USD' });
  });

  it('handles a month with no active employees', async () => {
    const run = await api.createRun();
    const res = await api.calculate(run.id);
    expect(res.body.summary).toEqual({ headcount: 0, flaggedCount: 0, byCountry: [] });
  });

  it('refuses to calculate a run that is no longer a draft', async () => {
    const run = await api.createRun();
    await prisma.payrollRun.update({ where: { id: run.id }, data: { status: 'FINALISED' } });

    const res = await api.calculate(run.id);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Only a draft payroll run can be calculated');
  });

  it('returns 404 for a run that does not exist', async () => {
    expect((await api.calculate(99999)).status).toBe(404);
  });
});

describe('GET /api/payroll-runs/:id — FR-PAY-03 summary', () => {
  it('shows headcount and totals per country, each in its own currency — never one combined total', async () => {
    await addEmployee('US Standard', '60000'); // net 5,810.00
    await addEmployee('US Standard', '60000'); // net 5,810.00
    await addEmployee('IN Standard', '1800000'); // net 1,74,470.00
    const run = await api.createRun();
    await api.calculate(run.id);

    const res = await request(app).get(`/api/payroll-runs/${run.id}`).set(bearer(hrToken));

    expect(res.body.summary).toEqual({
      headcount: 3,
      flaggedCount: 0,
      byCountry: [
        {
          countryCode: 'IN',
          countryName: 'India',
          currency: 'INR',
          headcount: 1,
          flaggedCount: 0,
          gross: { amount: '228200.00', currency: 'INR' },
          totalDeductions: { amount: '53730.00', currency: 'INR' },
          net: { amount: '174470.00', currency: 'INR' },
        },
        {
          countryCode: 'US',
          countryName: 'United States',
          currency: 'USD',
          headcount: 2,
          flaggedCount: 0,
          gross: { amount: '15400.00', currency: 'USD' },
          totalDeductions: { amount: '3780.00', currency: 'USD' },
          net: { amount: '11620.00', currency: 'USD' },
        },
      ],
    });
  });
});

describe('GET /api/payroll-runs/:id/payslips — FR-PAY-03 per-employee review', () => {
  it('lists the run’s payslips with paging and filters by country', async () => {
    for (let i = 0; i < 3; i++) await addEmployee('US Standard', '60000');
    await addEmployee('DE Standard', '55000');
    const run = await api.createRun();
    await api.calculate(run.id);

    const page = await api.payslips(run.id, { pageSize: 2 });
    expect(page.body).toMatchObject({ total: 4, page: 1, pageSize: 2, totalPages: 2 });
    expect(page.body.items).toHaveLength(2);

    const germany = await api.payslips(run.id, { country: 'DE' });
    expect(germany.body.items).toHaveLength(1);
    expect(germany.body.items[0]).toMatchObject({
      country: { code: 'DE', name: 'Germany' },
      currency: 'EUR',
      net: { currency: 'EUR' },
    });
  });

  it('opens one employee’s full breakdown before finalising', async () => {
    const employee = await addEmployee('US Standard', '60000');
    const run = await api.createRun();
    await api.saveInputs(run.id, [
      { employeeId: employee.id, overtimeHours: 10, bonus: 1000, achievementPct: 80 },
    ]);
    await api.calculate(run.id);
    const [summary] = (await api.payslips(run.id)).body.items;

    const res = await api.payslip(run.id, summary.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      employeeCode: employee.employeeCode,
      month: '2026-10',
      structureName: 'US Standard',
      currency: 'USD',
      annualBaseSalary: { amount: '60000.00', currency: 'USD' },
      inputs: {
        overtimeHours: '10',
        bonus: { amount: '1000.00', currency: 'USD' },
        achievementPct: '80',
      },
      gross: { amount: '9068.75', currency: 'USD' },
      totalDeductions: { amount: '2163.75', currency: 'USD' },
      net: { amount: '6905.00', currency: 'USD' },
      paymentStatus: 'DRAFT',
      paymentDate: null,
    });
    expect(res.body.earnings.map((l: { label: string }) => l.label)).toEqual([
      'Monthly base',
      'Housing allowance',
      'Transport allowance',
      'Variable pay',
      'Overtime',
      'Bonus',
    ]);
    expect(res.body.deductions[0]).toEqual({
      kind: 'DEDUCTION',
      label: 'Income tax',
      calculation: '20% × 9068.75',
      amount: { amount: '1813.75', currency: 'USD' },
    });
  });

  it('returns 404 for a payslip of another run', async () => {
    await addEmployee('US Standard', '60000');
    const october = await api.createRun('2026-10');
    const november = await api.createRun('2026-11');
    await api.calculate(october.id);
    const [payslip] = (await api.payslips(october.id)).body.items;

    const res = await api.payslip(november.id, payslip.id);

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Payslip not found in this payroll run');
  });

  it('rejects an invalid filter', async () => {
    const run = await api.createRun();
    expect((await api.payslips(run.id, { flagged: 'yes' })).status).toBe(400);
  });
});

describe('FR-AUTH-02: calculating and reviewing payroll is HR-only', () => {
  it('refuses employees', async () => {
    const { employee, password } = await createEmployeeAccount();
    const token = await loginAs(app, employee.employeeCode, password);
    const run = await api.createRun();

    for (const call of [
      request(app).post(`/api/payroll-runs/${run.id}/calculate`),
      request(app).get(`/api/payroll-runs/${run.id}/payslips`),
      request(app).get(`/api/payroll-runs/${run.id}/payslips/1`),
    ]) {
      expect((await call.set(bearer(token))).status).toBe(403);
    }
    expect(await prisma.payslip.count()).toBe(0);
  });
});
