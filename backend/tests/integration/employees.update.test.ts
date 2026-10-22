import request from 'supertest';
import { seedReferenceData } from '../../prisma/seed/seedReferenceData';
import { createApp } from '../../src/app';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createHrAccount } from '../helpers/factories';

const app = createApp();
let hrToken: string;

const structureId = async (name: string) =>
  (await prisma.salaryStructure.findUniqueOrThrow({ where: { name } })).id;

/** Creates the PRD example employee (US Standard, USD 60,000) through the API. */
async function createUsEmployee() {
  const res = await request(app)
    .post('/api/employees')
    .set(bearer(hrToken))
    .send({
      fullName: 'Asha Rao',
      jobTitle: 'Software Engineer',
      countryCode: 'US',
      annualBaseSalary: '60000',
      structureId: await structureId('US Standard'),
    });
  return res.body as { employee: { id: number; employeeCode: string }; temporaryPassword: string };
}

/** Creates an employee who has already replaced their temporary password, and logs them in. */
async function createLoggedInEmployee() {
  const { employee, temporaryPassword } = await createUsEmployee();
  const token = await loginAs(app, employee.employeeCode, temporaryPassword);
  await request(app)
    .post('/api/auth/change-password')
    .set(bearer(token))
    .send({ currentPassword: temporaryPassword, newPassword: 'MyOwnPassw0rd' });
  return { employee, token, password: 'MyOwnPassw0rd' };
}

const patch = (id: number, body: object) =>
  request(app).patch(`/api/employees/${id}`).set(bearer(hrToken)).send(body);
const post = (path: string) => request(app).post(path).set(bearer(hrToken));

beforeEach(async () => {
  await resetDb();
  await seedReferenceData();
  const { account, password } = await createHrAccount();
  hrToken = await loginAs(app, account.loginId, password);
});
afterAll(() => prisma.$disconnect());

describe('PATCH /api/employees/:id — FR-EMP-03', () => {
  it('saves a change to name and job title and returns the updated employee', async () => {
    const { employee } = await createUsEmployee();

    const res = await patch(employee.id, { fullName: 'Asha R. Rao', jobTitle: ' Lead Engineer ' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fullName: 'Asha R. Rao', jobTitle: 'Lead Engineer' });
    const view = await request(app).get(`/api/employees/${employee.id}`).set(bearer(hrToken));
    expect(view.body.jobTitle).toBe('Lead Engineer');
  });

  it('FR-EMP-06: a salary change is reflected in the standard monthly salary', async () => {
    const { employee } = await createUsEmployee();

    const res = await patch(employee.id, { annualBaseSalary: '72000' });

    expect(res.body.annualBaseSalary).toEqual({ amount: '72000.00', currency: 'USD' });
    expect(res.body.standardMonthlySalary.earnings[0].amount.amount).toBe('6000.00');
  });

  it('allows switching to another structure of the same country', async () => {
    const { employee } = await createUsEmployee();
    const res = await patch(employee.id, { structureId: await structureId('US Sales') });
    expect(res.status).toBe(200);
    expect(res.body.structure.name).toBe('US Sales');
  });

  it('rejects a structure that belongs to another country', async () => {
    const { employee } = await createUsEmployee();
    const res = await patch(employee.id, { structureId: await structureId('GB Standard') });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({
      structureId: 'Choose a salary structure for United States',
    });
  });

  describe('changing the country', () => {
    it('requires the salary to be re-entered in the new currency and a new structure', async () => {
      const { employee } = await createUsEmployee();

      const res = await patch(employee.id, { countryCode: 'IN' });

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Changing the country requires a new salary and salary structure',
        fields: {
          annualBaseSalary: 'Re-enter the annual base salary in INR for India',
          structureId: 'Choose a salary structure for India',
        },
      });
    });

    it('requires the structure even when the salary is given (and vice versa)', async () => {
      const { employee } = await createUsEmployee();

      const salaryOnly = await patch(employee.id, {
        countryCode: 'IN',
        annualBaseSalary: '1800000',
      });
      expect(Object.keys(salaryOnly.body.error.fields)).toEqual(['structureId']);

      const structureOnly = await patch(employee.id, {
        countryCode: 'IN',
        structureId: await structureId('IN Standard'),
      });
      expect(Object.keys(structureOnly.body.error.fields)).toEqual(['annualBaseSalary']);
    });

    it('rejects keeping the old country’s structure', async () => {
      const { employee } = await createUsEmployee();
      const res = await patch(employee.id, {
        countryCode: 'IN',
        annualBaseSalary: '1800000',
        structureId: await structureId('US Standard'),
      });
      expect(res.status).toBe(400);
      expect(res.body.error.fields).toEqual({ structureId: 'Choose a salary structure for India' });
    });

    it('rejects an unsupported country', async () => {
      const { employee } = await createUsEmployee();
      const res = await patch(employee.id, {
        countryCode: 'FR',
        annualBaseSalary: '50000',
        structureId: await structureId('US Standard'),
      });
      expect(res.body.error.fields).toEqual({ countryCode: 'Not a supported country' });
    });

    it('FR-CUR-01: switches the currency and keeps the new amount exactly as entered — nothing is converted', async () => {
      const { employee } = await createUsEmployee();

      const res = await patch(employee.id, {
        countryCode: 'in',
        annualBaseSalary: '1800000',
        structureId: await structureId('IN Standard'),
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        country: { code: 'IN', name: 'India' },
        currency: 'INR',
        annualBaseSalary: { amount: '1800000.00', currency: 'INR' },
        structure: { name: 'IN Standard' },
      });
      expect(res.body.standardMonthlySalary.net.currency).toBe('INR');
      expect(res.body.standardMonthlySalary.earnings[0].amount.amount).toBe('150000.00');
    });

    it('treats sending the current country as "no country change"', async () => {
      const { employee } = await createUsEmployee();
      const res = await patch(employee.id, { countryCode: 'US', jobTitle: 'Staff Engineer' });
      expect(res.status).toBe(200);
    });
  });

  it('changes nothing when any field is invalid (NFR-05)', async () => {
    const { employee } = await createUsEmployee();

    const res = await patch(employee.id, { jobTitle: 'New Title', annualBaseSalary: '-1' });

    expect(res.status).toBe(400);
    const saved = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
    expect(saved.jobTitle).toBe('Software Engineer');
  });

  it('rejects an empty change', async () => {
    const { employee } = await createUsEmployee();
    const res = await patch(employee.id, {});
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ _: 'Provide at least one field to change' });
  });

  it('never changes the Employee ID or status through an edit', async () => {
    const { employee } = await createUsEmployee();
    const res = await patch(employee.id, {
      jobTitle: 'Lead',
      employeeCode: 'EMP99999',
      status: 'INACTIVE',
    });
    expect(res.body).toMatchObject({ employeeCode: employee.employeeCode, status: 'ACTIVE' });
  });

  it('returns 404 for an employee that does not exist', async () => {
    const res = await patch(99999, { jobTitle: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/employees/:id/deactivate — FR-EMP-04', () => {
  it('marks the employee inactive and keeps the record', async () => {
    const { employee } = await createUsEmployee();

    const res = await post(`/api/employees/${employee.id}/deactivate`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INACTIVE');
    const view = await request(app).get(`/api/employees/${employee.id}`).set(bearer(hrToken));
    expect(view.status).toBe(200);
    expect(view.body.status).toBe('INACTIVE');
  });

  it('ends the employee’s open sessions immediately', async () => {
    const { employee, token } = await createLoggedInEmployee();

    await post(`/api/employees/${employee.id}/deactivate`);

    const me = await request(app).get('/api/auth/me').set(bearer(token));
    expect(me.status).toBe(401);
  });

  it('stops the employee from logging in', async () => {
    const { employee, password } = await createLoggedInEmployee();

    await post(`/api/employees/${employee.id}/deactivate`);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ loginId: employee.employeeCode, password });
    expect(login.status).toBe(403);
    expect(login.body.error.message).toBe('This account has been deactivated');
  });

  it('does not affect other employees’ sessions', async () => {
    const other = await createLoggedInEmployee();
    const { employee } = await createUsEmployee();

    await post(`/api/employees/${employee.id}/deactivate`);

    expect((await request(app).get('/api/auth/me').set(bearer(other.token))).status).toBe(200);
  });

  it('reports a conflict when the employee is already inactive', async () => {
    const { employee } = await createUsEmployee();
    await post(`/api/employees/${employee.id}/deactivate`);

    const again = await post(`/api/employees/${employee.id}/deactivate`);

    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe('Employee is already inactive');
  });

  it('returns 404 for an employee that does not exist', async () => {
    expect((await post('/api/employees/99999/deactivate')).status).toBe(404);
  });
});

describe('POST /api/employees/:id/reset-password — FR-AUTH-06', () => {
  it('issues a new temporary password; the old password stops working', async () => {
    const { employee, password } = await createLoggedInEmployee();

    const res = await post(`/api/employees/${employee.id}/reset-password`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ temporaryPassword: expect.stringMatching(/^[A-Za-z2-9]{12}$/) });
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ loginId: employee.employeeCode, password });
    expect(oldLogin.status).toBe(401);
  });

  it('FR-AUTH-04: the employee must change the new temporary password on next login', async () => {
    const { employee } = await createLoggedInEmployee();

    const { temporaryPassword } = (await post(`/api/employees/${employee.id}/reset-password`)).body;
    const login = await request(app)
      .post('/api/auth/login')
      .send({ loginId: employee.employeeCode, password: temporaryPassword });

    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
  });

  it('ends the employee’s open sessions', async () => {
    const { employee, token } = await createLoggedInEmployee();
    await post(`/api/employees/${employee.id}/reset-password`);
    expect((await request(app).get('/api/auth/me').set(bearer(token))).status).toBe(401);
  });

  it('refuses for a deactivated employee', async () => {
    const { employee } = await createUsEmployee();
    await post(`/api/employees/${employee.id}/deactivate`);

    const res = await post(`/api/employees/${employee.id}/reset-password`);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Cannot reset the password of a deactivated employee');
  });

  it('returns 404 for an employee that does not exist', async () => {
    expect((await post('/api/employees/99999/reset-password')).status).toBe(404);
  });
});

describe('FR-AUTH-02: edit, deactivate and reset are HR-only', () => {
  it('refuses an employee on every action', async () => {
    const { employee, token } = await createLoggedInEmployee();
    const asEmployee = (method: 'patch' | 'post', path: string) =>
      request(app)[method](path).set(bearer(token)).send({ jobTitle: 'CEO' });

    expect((await asEmployee('patch', `/api/employees/${employee.id}`)).status).toBe(403);
    expect((await asEmployee('post', `/api/employees/${employee.id}/deactivate`)).status).toBe(403);
    expect((await asEmployee('post', `/api/employees/${employee.id}/reset-password`)).status).toBe(
      403,
    );
    const saved = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } });
    expect(saved).toMatchObject({ jobTitle: 'Software Engineer', status: 'ACTIVE' });
  });
});
