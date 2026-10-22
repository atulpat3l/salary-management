import request from 'supertest';
import { seedReferenceData } from '../../prisma/seed/seedReferenceData';
import { createApp } from '../../src/app';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createEmployee, createEmployeeAccount, createHrAccount } from '../helpers/factories';

const app = createApp();
let hrToken: string;

const api = {
  createRun: (month: string) =>
    request(app).post('/api/payroll-runs').set(bearer(hrToken)).send({ month }),
  saveInputs: (runId: number, inputs: object[]) =>
    request(app).put(`/api/payroll-runs/${runId}/inputs`).set(bearer(hrToken)).send({ inputs }),
  listInputs: (runId: number) =>
    request(app).get(`/api/payroll-runs/${runId}/inputs`).set(bearer(hrToken)),
};

beforeEach(async () => {
  await resetDb();
  await seedReferenceData();
  const { account, password } = await createHrAccount();
  hrToken = await loginAs(app, account.loginId, password);
});
afterAll(() => prisma.$disconnect());

describe('POST /api/payroll-runs — creating a run', () => {
  it('creates a draft run for a month', async () => {
    const res = await api.createRun('2026-10');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      month: '2026-10',
      status: 'DRAFT',
      calculatedAt: null,
      finalisedAt: null,
      disbursedAt: null,
      paymentDate: null,
      createdAt: expect.any(String),
    });
  });

  it('FR-PAY-04: refuses a second run for the same month', async () => {
    await api.createRun('2026-10');

    const again = await api.createRun('2026-10');

    expect(again.status).toBe(409);
    expect(again.body.error).toEqual({
      code: 'CONFLICT',
      message: 'A payroll run for 2026-10 already exists',
    });
    expect(await prisma.payrollRun.count()).toBe(1);
  });

  it('rejects a malformed month', async () => {
    const res = await api.createRun('10/2026');
    expect(res.status).toBe(400);
    expect(res.body.error.fields.month).toBe('Month must be in YYYY-MM format, e.g. 2026-10');
  });

  it('lists runs newest month first and shows one run', async () => {
    const sept = (await api.createRun('2026-09')).body;
    await api.createRun('2026-10');
    await api.createRun('2026-08');

    const list = await request(app).get('/api/payroll-runs').set(bearer(hrToken));
    expect(list.body.map((r: { month: string }) => r.month)).toEqual([
      '2026-10',
      '2026-09',
      '2026-08',
    ]);

    const one = await request(app).get(`/api/payroll-runs/${sept.id}`).set(bearer(hrToken));
    expect(one.body).toEqual({
      ...sept,
      summary: { headcount: 0, flaggedCount: 0, byCountry: [] }, // not calculated yet
    });
  });

  it('returns 404 for a run that does not exist', async () => {
    const res = await request(app).get('/api/payroll-runs/99999').set(bearer(hrToken));
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Payroll run not found');
  });
});

describe('PUT /api/payroll-runs/:id/inputs — FR-PAY-01', () => {
  it('saves inputs and shows them back, with the bonus in the employee’s currency', async () => {
    const run = (await api.createRun('2026-10')).body;
    const us = await createEmployee({ countryCode: 'US' });
    const india = await createEmployee({ countryCode: 'IN' });

    const res = await api.saveInputs(run.id, [
      { employeeId: us.id, overtimeHours: 10, bonus: '1000', achievementPct: 80 },
      { employeeId: india.id, bonus: '25000.50' },
    ]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: 2 });
    expect((await api.listInputs(run.id)).body).toEqual([
      {
        employeeId: us.id,
        employeeCode: us.employeeCode,
        fullName: us.fullName,
        overtimeHours: '10',
        bonus: { amount: '1000.00', currency: 'USD' },
        achievementPct: '80',
      },
      {
        employeeId: india.id,
        employeeCode: india.employeeCode,
        fullName: india.fullName,
        // Not entered → defaults
        overtimeHours: '0',
        bonus: { amount: '25000.50', currency: 'INR' },
        achievementPct: '100',
      },
    ]);
  });

  it('replaces an employee’s earlier inputs; fields left out go back to their defaults', async () => {
    const run = (await api.createRun('2026-10')).body;
    const employee = await createEmployee();
    await api.saveInputs(run.id, [
      { employeeId: employee.id, overtimeHours: 10, bonus: 500, achievementPct: 150 },
    ]);

    await api.saveInputs(run.id, [{ employeeId: employee.id, bonus: 750 }]);

    const [saved] = (await api.listInputs(run.id)).body;
    expect(saved).toMatchObject({
      overtimeHours: '0',
      bonus: { amount: '750.00' },
      achievementPct: '100',
    });
    expect(await prisma.payrollInput.count()).toBe(1);
  });

  it('keeps inputs separate per run', async () => {
    const october = (await api.createRun('2026-10')).body;
    const november = (await api.createRun('2026-11')).body;
    const employee = await createEmployee();

    await api.saveInputs(october.id, [{ employeeId: employee.id, bonus: 100 }]);

    expect((await api.listInputs(november.id)).body).toEqual([]);
  });

  it('rejects invalid values with a message for the exact row and field', async () => {
    const run = (await api.createRun('2026-10')).body;
    const employee = await createEmployee();

    const res = await api.saveInputs(run.id, [
      { employeeId: employee.id, overtimeHours: 500, achievementPct: 250 },
    ]);

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({
      'inputs.0.overtimeHours': 'Overtime hours must be at most 100',
      'inputs.0.achievementPct': 'Achievement % must be at most 200',
    });
  });

  it('rejects unknown and inactive employees, and saves nothing from the request (NFR-05)', async () => {
    const run = (await api.createRun('2026-10')).body;
    const active = await createEmployee();
    const inactive = await createEmployee({ status: 'INACTIVE' });

    const res = await api.saveInputs(run.id, [
      { employeeId: active.id, bonus: 100 },
      { employeeId: inactive.id, bonus: 100 },
      { employeeId: 99999, bonus: 100 },
    ]);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Some inputs are invalid',
      fields: {
        'inputs.1.employeeId': 'Employee is inactive and not included in payroll',
        'inputs.2.employeeId': 'Employee not found',
      },
    });
    expect(await prisma.payrollInput.count()).toBe(0);
  });

  it('refuses changes once the run is no longer a draft', async () => {
    const run = (await api.createRun('2026-10')).body;
    const employee = await createEmployee();
    await prisma.payrollRun.update({ where: { id: run.id }, data: { status: 'FINALISED' } });

    const res = await api.saveInputs(run.id, [{ employeeId: employee.id, bonus: 100 }]);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe(
      'Monthly inputs can only be changed while the payroll run is a draft',
    );
  });

  it('returns 404 for inputs of a run that does not exist', async () => {
    const employee = await createEmployee();
    expect((await api.saveInputs(99999, [{ employeeId: employee.id }])).status).toBe(404);
    expect((await api.listInputs(99999)).status).toBe(404);
  });

  it('accepts inputs for many employees in one request', async () => {
    const run = (await api.createRun('2026-10')).body;
    const employees = [];
    for (let i = 0; i < 50; i++) employees.push(await createEmployee());

    const res = await api.saveInputs(
      run.id,
      employees.map((e, i) => ({ employeeId: e.id, overtimeHours: i % 10 })),
    );

    expect(res.body).toEqual({ saved: 50 });
    expect(await prisma.payrollInput.count({ where: { runId: run.id } })).toBe(50);
  });
});

describe('FR-AUTH-02: payroll is HR-only', () => {
  it('refuses employees on every payroll route', async () => {
    const { employee, password } = await createEmployeeAccount();
    const token = await loginAs(app, employee.employeeCode, password);
    const run = (await api.createRun('2026-10')).body;

    for (const call of [
      request(app).get('/api/payroll-runs'),
      request(app).post('/api/payroll-runs').send({ month: '2026-11' }),
      request(app).get(`/api/payroll-runs/${run.id}`),
      request(app).get(`/api/payroll-runs/${run.id}/inputs`),
      request(app)
        .put(`/api/payroll-runs/${run.id}/inputs`)
        .send({ inputs: [{ employeeId: employee.id, bonus: 1000000 }] }),
    ]) {
      expect((await call.set(bearer(token))).status).toBe(403);
    }
    expect(await prisma.payrollInput.count()).toBe(0);
    expect(await prisma.payrollRun.count()).toBe(1);
  });
});
