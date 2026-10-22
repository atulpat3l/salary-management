import request from 'supertest';
import { seedReferenceData } from '../../prisma/seed/seedReferenceData';
import { createApp } from '../../src/app';
import { hashPassword } from '../../src/modules/auth/password';
import {
  calculateRun,
  createRun,
  disburseRun,
  finaliseRun,
  saveInputs,
} from '../../src/modules/payroll/payroll.service';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { DEFAULT_PASSWORD, createHrAccount } from '../helpers/factories';

const app = createApp();

let codeSequence = 0;
/** An employee on a seeded structure, with a login whose password is already their own. */
async function addEmployeeWithLogin(structureName = 'US Standard', annualBaseSalary = '60000') {
  const structure = await prisma.salaryStructure.findUniqueOrThrow({
    where: { name: structureName },
  });
  const employeeCode = `EMP${String(++codeSequence).padStart(5, '0')}`;
  const employee = await prisma.employee.create({
    data: {
      employeeCode,
      fullName: `Employee ${codeSequence}`,
      jobTitle: 'Engineer',
      countryCode: structure.countryCode,
      annualBaseSalary,
      structureId: structure.id,
    },
  });
  await prisma.account.create({
    data: {
      loginId: employeeCode,
      passwordHash: await hashPassword(DEFAULT_PASSWORD),
      role: 'EMPLOYEE',
      mustChangePassword: false,
      employeeId: employee.id,
    },
  });
  const token = await loginAs(app, employeeCode, DEFAULT_PASSWORD);
  return { employee, token };
}

/** Runs payroll for a month up to the given status. */
async function runPayroll(month: string, until: 'DRAFT' | 'FINALISED' | 'DISBURSED') {
  const run = await createRun(month);
  if (until !== 'DRAFT') await finaliseRun(run.id);
  if (until === 'DISBURSED') await disburseRun(run.id, `${month}-28`);
  return run;
}

const get = (path: string, token: string) => request(app).get(path).set(bearer(token));
const payslipIdOf = async (employeeId: number, month: string) =>
  (
    await prisma.payslip.findFirstOrThrow({
      where: { employeeId, run: { month } },
    })
  ).id;

beforeEach(async () => {
  await resetDb();
  await seedReferenceData();
});
afterAll(() => prisma.$disconnect());

describe('GET /api/me — FR-ESS-04 profile', () => {
  it('shows the employee’s own details and standard monthly salary, read-only', async () => {
    const { employee, token } = await addEmployeeWithLogin();

    const res = await get('/api/me', token);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      jobTitle: 'Engineer',
      country: { code: 'US', name: 'United States' },
      currency: 'USD',
      annualBaseSalary: { amount: '60000.00', currency: 'USD' },
      structure: { name: 'US Standard', style: 'STANDARD' },
      standardMonthlySalary: { net: { amount: '5810.00', currency: 'USD' } },
    });
  });

  it('has no way to edit anything', async () => {
    const { token } = await addEmployeeWithLogin();
    const res = await request(app)
      .patch('/api/me')
      .set(bearer(token))
      .send({ annualBaseSalary: '999999' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/me/payslips — FR-ESS-01', () => {
  it('lists the employee’s issued payslips newest first, with month, gross, net and status', async () => {
    const { employee, token } = await addEmployeeWithLogin();
    await runPayroll('2026-07', 'DISBURSED');
    await runPayroll('2026-08', 'FINALISED');

    const res = await get('/api/me/payslips', token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: await payslipIdOf(employee.id, '2026-08'),
        month: '2026-08',
        currency: 'USD',
        gross: { amount: '7700.00', currency: 'USD' },
        totalDeductions: { amount: '1890.00', currency: 'USD' },
        net: { amount: '5810.00', currency: 'USD' },
        paymentStatus: 'PENDING',
        paymentDate: null,
      },
      expect.objectContaining({
        month: '2026-07',
        paymentStatus: 'PAID',
        paymentDate: '2026-07-28',
      }),
    ]);
  });

  it('does not show a month whose payroll is still a draft', async () => {
    const { token } = await addEmployeeWithLogin();
    await runPayroll('2026-07', 'FINALISED');
    const draft = await createRun('2026-08');
    await calculateRun(draft.id); // draft payslips now exist, but must stay hidden

    const months = (await get('/api/me/payslips', token)).body.map(
      (p: { month: string }) => p.month,
    );
    expect(months).toEqual(['2026-07']);
  });

  it('returns an empty list for a new joiner with no payslips yet', async () => {
    const existing = await addEmployeeWithLogin();
    await runPayroll('2026-07', 'DISBURSED');
    const newJoiner = await addEmployeeWithLogin(); // joined after July was paid

    expect((await get('/api/me/payslips', newJoiner.token)).body).toEqual([]);
    expect((await get('/api/me/payslips', existing.token)).body).toHaveLength(1);
  });

  it('never includes another employee’s payslips', async () => {
    const asha = await addEmployeeWithLogin('US Standard', '60000');
    const ravi = await addEmployeeWithLogin('IN Standard', '1800000');
    await runPayroll('2026-07', 'DISBURSED');

    const ashaPayslips = (await get('/api/me/payslips', asha.token)).body;
    const raviPayslips = (await get('/api/me/payslips', ravi.token)).body;

    expect(ashaPayslips).toHaveLength(1);
    expect(ashaPayslips[0].currency).toBe('USD');
    expect(raviPayslips).toHaveLength(1);
    expect(raviPayslips[0].currency).toBe('INR');
    expect(ashaPayslips[0].id).not.toBe(raviPayslips[0].id);
  });
});

describe('GET /api/me/payslips/:id — FR-ESS-02', () => {
  it('shows the full payslip exactly as issued, matching what HR sees', async () => {
    const { employee, token } = await addEmployeeWithLogin();
    const run = await createRun('2026-07');
    await saveInputs(run.id, [
      { employeeId: employee.id, overtimeHours: '10', bonus: '1000', achievementPct: '80' },
    ]);
    await finaliseRun(run.id);
    await disburseRun(run.id, '2026-07-31');
    const payslipId = await payslipIdOf(employee.id, '2026-07');

    const mine = await get(`/api/me/payslips/${payslipId}`, token);

    expect(mine.status).toBe(200);
    expect(mine.body).toMatchObject({
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      jobTitle: 'Engineer',
      country: { code: 'US', name: 'United States' },
      currency: 'USD',
      month: '2026-07',
      gross: { amount: '9068.75', currency: 'USD' },
      totalDeductions: { amount: '2163.75', currency: 'USD' },
      net: { amount: '6905.00', currency: 'USD' }, // PRD worked example 1
      paymentStatus: 'PAID',
      paymentDate: '2026-07-31',
    });
    expect(mine.body.earnings).toHaveLength(6);
    expect(mine.body.deductions).toHaveLength(3);

    const { account, password } = await createHrAccount();
    const hrToken = await loginAs(app, account.loginId, password);
    const hrView = await get(`/api/payroll-runs/${run.id}/payslips/${payslipId}`, hrToken);
    expect(mine.body).toEqual(hrView.body);
  });

  it('FR-AUTH-02: answers 404 for another employee’s payslip, even with a valid id', async () => {
    const asha = await addEmployeeWithLogin();
    const ravi = await addEmployeeWithLogin();
    await runPayroll('2026-07', 'DISBURSED');
    const ravisPayslip = await payslipIdOf(ravi.employee.id, '2026-07');

    const res = await get(`/api/me/payslips/${ravisPayslip}`, asha.token);

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Payslip not found' });
  });

  it('answers 404 for the employee’s own payslip while the run is still a draft', async () => {
    const { employee, token } = await addEmployeeWithLogin();
    const run = await createRun('2026-07');
    await calculateRun(run.id);
    const draftPayslip = await payslipIdOf(employee.id, '2026-07');

    expect((await get(`/api/me/payslips/${draftPayslip}`, token)).status).toBe(404);
  });

  it('answers 404 for an id that does not exist, and 400 for a malformed one', async () => {
    const { token } = await addEmployeeWithLogin();
    expect((await get('/api/me/payslips/99999', token)).status).toBe(404);
    expect((await get('/api/me/payslips/abc', token)).status).toBe(400);
  });

  it('FR-PAY-05: still shows the original currency after the employee relocates', async () => {
    const { employee, token } = await addEmployeeWithLogin();
    await runPayroll('2026-07', 'DISBURSED');
    const inStandard = await prisma.salaryStructure.findUniqueOrThrow({
      where: { name: 'IN Standard' },
    });
    await prisma.employee.update({
      where: { id: employee.id },
      data: { countryCode: 'IN', annualBaseSalary: '1800000', structureId: inStandard.id },
    });

    const payslipId = await payslipIdOf(employee.id, '2026-07');
    const res = await get(`/api/me/payslips/${payslipId}`, token);

    expect(res.body.net).toEqual({ amount: '5810.00', currency: 'USD' });
    expect((await get('/api/me', token)).body.currency).toBe('INR');
  });
});

describe('GET /api/me/disbursements — FR-ESS-03', () => {
  it('lists paid months with the net amount and date, and finalised months as pending', async () => {
    const { token } = await addEmployeeWithLogin('IN Standard', '1800000');
    await runPayroll('2026-06', 'DISBURSED');
    await runPayroll('2026-07', 'DISBURSED');
    await runPayroll('2026-08', 'FINALISED');
    await runPayroll('2026-09', 'DRAFT');

    const res = await get('/api/me/disbursements', token);

    expect(res.status).toBe(200);
    expect(
      res.body.map((d: { month: string; status: string; paymentDate: string | null }) => [
        d.month,
        d.status,
        d.paymentDate,
      ]),
    ).toEqual([
      ['2026-08', 'PENDING', null],
      ['2026-07', 'PAID', '2026-07-28'],
      ['2026-06', 'PAID', '2026-06-28'],
    ]);
    expect(res.body[1].netPaid).toEqual({ amount: '174470.00', currency: 'INR' });
  });
});

describe('FR-AUTH-02: self-service is for employees only', () => {
  it('refuses HR (HR has no payslips of its own)', async () => {
    const { account, password } = await createHrAccount();
    const hrToken = await loginAs(app, account.loginId, password);
    for (const path of ['/api/me', '/api/me/payslips', '/api/me/disbursements']) {
      expect((await get(path, hrToken)).status).toBe(403);
    }
  });

  it('requires login', async () => {
    expect((await request(app).get('/api/me/payslips')).status).toBe(401);
  });

  it('FR-AUTH-04: is blocked until a temporary password is changed', async () => {
    const { employee, token } = await addEmployeeWithLogin();
    await prisma.account.update({
      where: { employeeId: employee.id },
      data: { mustChangePassword: true },
    });
    expect((await get('/api/me/payslips', token)).status).toBe(403);
  });

  it('an employee still cannot reach any HR data', async () => {
    const { employee, token } = await addEmployeeWithLogin();
    await runPayroll('2026-07', 'FINALISED');
    for (const path of [
      '/api/employees',
      `/api/employees/${employee.id}`,
      '/api/payroll-runs',
      '/api/structures',
    ]) {
      expect((await get(path, token)).status).toBe(403);
    }
  });
});
