import request from 'supertest';
import { seedReferenceData } from '../../prisma/seed/seedReferenceData';
import { createApp } from '../../src/app';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createEmployeeAccount, createHrAccount } from '../helpers/factories';

const app = createApp();
let hrToken: string;

// A past month, so payment dates in it are never "in the future".
const MONTH = '2026-01';

let codeSequence = 0;
async function addEmployee(structureName = 'US Standard', annualBaseSalary = '60000') {
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
    },
  });
}

const hr = () => bearer(hrToken);
const api = {
  createRun: async (month = MONTH) =>
    (await request(app).post('/api/payroll-runs').set(hr()).send({ month })).body as {
      id: number;
    },
  calculate: (id: number) => request(app).post(`/api/payroll-runs/${id}/calculate`).set(hr()),
  finalise: (id: number) => request(app).post(`/api/payroll-runs/${id}/finalise`).set(hr()),
  disburse: (id: number, paymentDate: string) =>
    request(app).post(`/api/payroll-runs/${id}/disburse`).set(hr()).send({ paymentDate }),
  run: (id: number) => request(app).get(`/api/payroll-runs/${id}`).set(hr()),
  payslips: (id: number) => request(app).get(`/api/payroll-runs/${id}/payslips`).set(hr()),
  payslip: (id: number, payslipId: number) =>
    request(app).get(`/api/payroll-runs/${id}/payslips/${payslipId}`).set(hr()),
};

beforeEach(async () => {
  await resetDb();
  await seedReferenceData();
  const { account, password } = await createHrAccount();
  hrToken = await loginAs(app, account.loginId, password);
});
afterAll(() => prisma.$disconnect());

describe('POST /api/payroll-runs/:id/finalise — FR-PAY-04', () => {
  it('locks the run and issues one payslip per active employee', async () => {
    await addEmployee();
    await addEmployee('IN Standard', '1800000');
    const run = await api.createRun();
    await api.calculate(run.id);

    const res = await api.finalise(run.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'FINALISED', summary: { headcount: 2 } });
    expect(new Date(res.body.finalisedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('issues pay from current data, even if HR did not recalculate after a change', async () => {
    const employee = await addEmployee();
    const run = await api.createRun();
    await api.calculate(run.id);
    await prisma.employee.update({
      where: { id: employee.id },
      data: { annualBaseSalary: '120000' },
    });

    await api.finalise(run.id);

    const [payslip] = (await api.payslips(run.id)).body.items;
    expect(payslip.gross.amount).not.toBe('7700.00');
  });

  it('can finalise without a separate calculate step', async () => {
    await addEmployee();
    const run = await api.createRun();
    const res = await api.finalise(run.id);
    expect(res.body.summary.byCountry[0].net).toEqual({ amount: '5810.00', currency: 'USD' });
  });

  it('is refused while any employee is flagged, and nothing changes (NFR-05)', async () => {
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
    await addEmployee('US Heavy Loan');
    await addEmployee();
    const run = await api.createRun();

    const res = await api.finalise(run.id);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      '1 employee(s) have deductions exceeding gross pay. Review the flagged payslips and recalculate before finalising.',
    );
    const after = await api.run(run.id);
    expect(after.body).toMatchObject({ status: 'DRAFT', finalisedAt: null });
    expect(await prisma.payslip.count()).toBe(0); // the attempted recalculation was rolled back
  });

  it('is refused when there is nobody to pay', async () => {
    const run = await api.createRun();
    const res = await api.finalise(run.id);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('There are no active employees to pay');
    expect((await api.run(run.id)).body.status).toBe('DRAFT');
  });

  it('cannot be done twice', async () => {
    await addEmployee();
    const run = await api.createRun();
    await api.finalise(run.id);

    const again = await api.finalise(run.id);

    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe('Only a draft payroll run can be finalised');
  });

  it('locks the run: no recalculation, no input changes, no second run for the month', async () => {
    const employee = await addEmployee();
    const run = await api.createRun();
    await api.finalise(run.id);

    expect((await api.calculate(run.id)).status).toBe(409);
    const inputs = await request(app)
      .put(`/api/payroll-runs/${run.id}/inputs`)
      .set(hr())
      .send({ inputs: [{ employeeId: employee.id, bonus: 100 }] });
    expect(inputs.status).toBe(409);
    const second = await request(app).post('/api/payroll-runs').set(hr()).send({ month: MONTH });
    expect(second.status).toBe(409);
  });

  it('returns 404 for a run that does not exist', async () => {
    expect((await api.finalise(99999)).status).toBe(404);
  });
});

describe('POST /api/payroll-runs/:id/disburse — FR-PAY-06', () => {
  async function finalisedRun() {
    await addEmployee();
    const run = await api.createRun();
    await api.finalise(run.id);
    return run;
  }

  it('marks a finalised run as paid with the payment date', async () => {
    const run = await finalisedRun();

    const res = await api.disburse(run.id, '2026-01-31');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'DISBURSED', paymentDate: '2026-01-31' });
    expect(res.body.disbursedAt).not.toBeNull();
  });

  it('shows every payslip in the run as paid, with the payment date', async () => {
    const run = await finalisedRun();
    const [summary] = (await api.payslips(run.id)).body.items;
    expect((await api.payslip(run.id, summary.id)).body).toMatchObject({
      paymentStatus: 'PENDING',
      paymentDate: null,
    });

    await api.disburse(run.id, '2026-01-31');

    expect((await api.payslip(run.id, summary.id)).body).toMatchObject({
      paymentStatus: 'PAID',
      paymentDate: '2026-01-31',
    });
  });

  it('is refused for a draft run', async () => {
    await addEmployee();
    const run = await api.createRun();

    const res = await api.disburse(run.id, '2026-01-31');

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Only a finalised payroll run can be marked as disbursed');
  });

  it('cannot be done twice, and the status never goes back', async () => {
    const run = await finalisedRun();
    await api.disburse(run.id, '2026-01-31');

    expect((await api.disburse(run.id, '2026-02-01')).status).toBe(409);
    expect((await api.finalise(run.id)).status).toBe(409);
    expect((await api.calculate(run.id)).status).toBe(409);
    expect((await api.run(run.id)).body).toMatchObject({
      status: 'DISBURSED',
      paymentDate: '2026-01-31',
    });
  });

  it('rejects a payment date before the payroll month', async () => {
    const run = await finalisedRun();
    const res = await api.disburse(run.id, '2025-12-31');
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({
      paymentDate: 'Payment date cannot be before the payroll month (2026-01)',
    });
  });

  it('rejects an invalid or future payment date', async () => {
    const run = await finalisedRun();
    expect((await api.disburse(run.id, '2026-02-30')).status).toBe(400);
    expect((await api.disburse(run.id, '2999-01-01')).status).toBe(400);
    expect((await api.run(run.id)).body.status).toBe('FINALISED');
  });
});

describe('FR-PAY-05: issued payslips are a permanent record', () => {
  it('stays exactly as issued after the employee’s name, title, salary, structure, country and status change', async () => {
    const employee = await addEmployee();
    const run = await api.createRun();
    await api.finalise(run.id);
    await api.disburse(run.id, '2026-01-31');
    const [summary] = (await api.payslips(run.id)).body.items;
    const issued = (await api.payslip(run.id, summary.id)).body;

    const inStandard = await prisma.salaryStructure.findUniqueOrThrow({
      where: { name: 'IN Standard' },
    });
    await request(app).patch(`/api/employees/${employee.id}`).set(hr()).send({
      fullName: 'Renamed Person',
      jobTitle: 'Director',
      countryCode: 'IN',
      annualBaseSalary: '5000000',
      structureId: inStandard.id,
    });
    await request(app).post(`/api/employees/${employee.id}/deactivate`).set(hr());

    const later = (await api.payslip(run.id, summary.id)).body;
    expect(later).toEqual(issued);
    expect(later).toMatchObject({
      fullName: issued.fullName,
      jobTitle: 'Engineer',
      currency: 'USD',
      country: { code: 'US', name: 'United States' },
      structureName: 'US Standard',
      net: { amount: '5810.00', currency: 'USD' },
    });
  });

  it('the next month’s payroll uses the new details, in the new currency', async () => {
    const employee = await addEmployee();
    const january = await api.createRun('2026-01');
    await api.finalise(january.id);

    const inStandard = await prisma.salaryStructure.findUniqueOrThrow({
      where: { name: 'IN Standard' },
    });
    await request(app).patch(`/api/employees/${employee.id}`).set(hr()).send({
      countryCode: 'IN',
      annualBaseSalary: '1800000',
      structureId: inStandard.id,
    });
    const february = await api.createRun('2026-02');
    await api.finalise(february.id);

    const [jan] = (await api.payslips(january.id)).body.items;
    const [feb] = (await api.payslips(february.id)).body.items;
    expect(jan.net).toEqual({ amount: '5810.00', currency: 'USD' });
    expect(feb.net).toEqual({ amount: '174470.00', currency: 'INR' });
  });
});

describe('GET /api/payroll-runs — FR-PAY-07 payroll history', () => {
  it('lists every run by month with status, headcount and per-country totals', async () => {
    await addEmployee();
    await addEmployee('DE Standard', '55000');
    const january = await api.createRun('2026-01');
    await api.finalise(january.id);
    await api.disburse(january.id, '2026-01-31');
    const february = await api.createRun('2026-02');
    await api.finalise(february.id);
    await api.createRun('2026-03');

    const res = await request(app).get('/api/payroll-runs').set(hr());

    expect(
      res.body.map((r: { month: string; status: string; summary: { headcount: number } }) => [
        r.month,
        r.status,
        r.summary.headcount,
      ]),
    ).toEqual([
      ['2026-03', 'DRAFT', 0],
      ['2026-02', 'FINALISED', 2],
      ['2026-01', 'DISBURSED', 2],
    ]);
    expect(
      res.body[2].summary.byCountry.map((c: { countryCode: string; net: { currency: string } }) => [
        c.countryCode,
        c.net.currency,
      ]),
    ).toEqual([
      ['DE', 'EUR'],
      ['US', 'USD'],
    ]);
  });
});

describe('FR-AUTH-02: finalising and disbursing are HR-only', () => {
  it('refuses employees', async () => {
    const { employee, password } = await createEmployeeAccount();
    const token = await loginAs(app, employee.employeeCode, password);
    const run = await api.createRun();

    for (const call of [
      request(app).post(`/api/payroll-runs/${run.id}/finalise`),
      request(app).post(`/api/payroll-runs/${run.id}/disburse`).send({ paymentDate: '2026-01-31' }),
    ]) {
      expect((await call.set(bearer(token))).status).toBe(403);
    }
    expect((await api.run(run.id)).body.status).toBe('DRAFT');
  });
});
