import request from 'supertest';
import { seedReferenceData } from '../../prisma/seed/seedReferenceData';
import { createApp } from '../../src/app';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createEmployeeAccount, createHrAccount } from '../helpers/factories';

const app = createApp();
let hrToken: string;

const structureId = async (name: string) =>
  (await prisma.salaryStructure.findUniqueOrThrow({ where: { name } })).id;

/** The PRD §5.7 example employee: US Standard, USD 60,000 a year. */
const prdEmployee = async () => ({
  fullName: 'Asha Rao',
  jobTitle: 'Software Engineer',
  countryCode: 'US',
  annualBaseSalary: '60000',
  structureId: await structureId('US Standard'),
});

const create = (body: object, token = hrToken) =>
  request(app).post('/api/employees').set(bearer(token)).send(body);

beforeEach(async () => {
  await resetDb();
  await seedReferenceData();
  const { account, password } = await createHrAccount();
  hrToken = await loginAs(app, account.loginId, password);
});
afterAll(() => prisma.$disconnect());

describe('POST /api/employees — FR-EMP-01', () => {
  it('saves the employee and returns them with a system-assigned Employee ID', async () => {
    const res = await create(await prdEmployee());

    expect(res.status).toBe(201);
    const { employee } = res.body;
    expect(employee.employeeCode).toBe(`EMP${String(employee.id).padStart(5, '0')}`);
    expect(employee).toMatchObject({
      fullName: 'Asha Rao',
      jobTitle: 'Software Engineer',
      country: { code: 'US', name: 'United States' },
      currency: 'USD',
      annualBaseSalary: { amount: '60000.00', currency: 'USD' },
      structure: { name: 'US Standard', style: 'STANDARD' },
      status: 'ACTIVE',
    });
    expect(await prisma.employee.count()).toBe(1);
  });

  it('FR-EMP-06: returns the standard monthly salary — PRD worked example 2 (net USD 5,810.00)', async () => {
    const { standardMonthlySalary } = (await create(await prdEmployee())).body.employee;

    expect(
      standardMonthlySalary.earnings.map((l: { label: string; amount: { amount: string } }) => [
        l.label,
        l.amount.amount,
      ]),
    ).toEqual([
      ['Monthly base', '5000.00'],
      ['Housing allowance', '2000.00'],
      ['Transport allowance', '200.00'],
      ['Variable pay', '500.00'],
    ]);
    expect(standardMonthlySalary.gross).toEqual({ amount: '7700.00', currency: 'USD' });
    expect(standardMonthlySalary.totalDeductions).toEqual({ amount: '1890.00', currency: 'USD' });
    expect(standardMonthlySalary.net).toEqual({ amount: '5810.00', currency: 'USD' });
  });

  it('FR-CUR-01: sets the currency from the country — an Indian employee is paid in INR', async () => {
    const res = await create({
      ...(await prdEmployee()),
      countryCode: 'IN',
      annualBaseSalary: '1800000',
      structureId: await structureId('IN Standard'),
    });

    const { employee } = res.body;
    expect(employee.currency).toBe('INR');
    expect(employee.annualBaseSalary).toEqual({ amount: '1800000.00', currency: 'INR' });
    expect(employee.standardMonthlySalary.net.currency).toBe('INR');
    // A currency sent by the client is simply ignored: it cannot be chosen separately.
    const withCurrency = await create({ ...(await prdEmployee()), currency: 'EUR' });
    expect(withCurrency.body.employee.currency).toBe('USD');
  });

  it('assigns increasing, unique Employee IDs', async () => {
    const first = (await create(await prdEmployee())).body.employee.employeeCode;
    const second = (await create(await prdEmployee())).body.employee.employeeCode;
    expect(first).not.toBe(second);
    expect(second > first).toBe(true);
  });

  it('A10: allows two employees with the same name', async () => {
    await create(await prdEmployee());
    expect((await create(await prdEmployee())).status).toBe(201);
    expect(await prisma.employee.count({ where: { fullName: 'Asha Rao' } })).toBe(2);
  });

  it('stores names without surrounding spaces', async () => {
    const res = await create({ ...(await prdEmployee()), fullName: '  Asha Rao  ' });
    expect(res.body.employee.fullName).toBe('Asha Rao');
  });
});

describe('POST /api/employees — credentials (FR-AUTH-04, NFR-06)', () => {
  it('returns a one-time temporary password the employee can log in with, then must change', async () => {
    const res = await create(await prdEmployee());
    const { employee, temporaryPassword } = res.body;
    expect(temporaryPassword).toMatch(/^[A-Za-z2-9]{12}$/);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ loginId: employee.employeeCode, password: temporaryPassword });

    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({
      loginId: employee.employeeCode,
      role: 'EMPLOYEE',
      mustChangePassword: true,
      employee: { id: employee.id, fullName: 'Asha Rao' },
    });
  });

  it('stores only a hash of the temporary password', async () => {
    const { temporaryPassword, employee } = (await create(await prdEmployee())).body;
    const account = await prisma.account.findUniqueOrThrow({
      where: { loginId: employee.employeeCode },
    });
    expect(account.passwordHash).not.toContain(temporaryPassword);
    expect(account.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('never shows the temporary password again when the employee is viewed', async () => {
    const { temporaryPassword, employee } = (await create(await prdEmployee())).body;
    const view = await request(app).get(`/api/employees/${employee.id}`).set(bearer(hrToken));
    expect(JSON.stringify(view.body)).not.toContain(temporaryPassword);
    expect(view.body).not.toHaveProperty('temporaryPassword');
    expect(JSON.stringify(view.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('gives every new employee a different temporary password', async () => {
    const a = (await create(await prdEmployee())).body.temporaryPassword;
    const b = (await create(await prdEmployee())).body.temporaryPassword;
    expect(a).not.toBe(b);
  });

  it('end to end: the new employee logs in, sets their own password, and can then use the app', async () => {
    const { employee, temporaryPassword } = (await create(await prdEmployee())).body;
    const token = await loginAs(app, employee.employeeCode, temporaryPassword);

    const change = await request(app)
      .post('/api/auth/change-password')
      .set(bearer(token))
      .send({ currentPassword: temporaryPassword, newPassword: 'MyOwnPassw0rd' });
    expect(change.status).toBe(204);

    const me = await request(app).get('/api/auth/me').set(bearer(token));
    expect(me.body.mustChangePassword).toBe(false);
  });
});

describe('POST /api/employees — validation (FR-EMP-05, NFR-05)', () => {
  it('rejects missing fields with a message for each field, and saves nothing', async () => {
    const res = await create({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual([
      'annualBaseSalary',
      'countryCode',
      'fullName',
      'jobTitle',
      'structureId',
    ]);
    expect(await prisma.employee.count()).toBe(0);
    expect(await prisma.account.count()).toBe(1); // only the HR account
  });

  it('rejects a salary that is not positive or has more than two decimals', async () => {
    for (const annualBaseSalary of ['0', '-5', '100.999']) {
      const res = await create({ ...(await prdEmployee()), annualBaseSalary });
      expect(res.status).toBe(400);
      expect(res.body.error.fields).toHaveProperty('annualBaseSalary');
    }
    expect(await prisma.employee.count()).toBe(0);
  });

  it('rejects an unsupported country', async () => {
    const res = await create({ ...(await prdEmployee()), countryCode: 'FR' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ countryCode: 'Not a supported country' });
  });

  it('rejects a salary structure from another country', async () => {
    const res = await create({
      ...(await prdEmployee()),
      structureId: await structureId('IN Sales'),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({
      structureId: 'Choose a salary structure for United States',
    });
    expect(await prisma.employee.count()).toBe(0);
  });

  it('rejects a salary structure that does not exist', async () => {
    const res = await create({ ...(await prdEmployee()), structureId: 99999 });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ structureId: 'Salary structure not found' });
  });
});

describe('GET /api/employees/:id — FR-EMP-02', () => {
  it('shows every detail HR needs, including the standard monthly salary', async () => {
    const { employee } = (await create(await prdEmployee())).body;

    const res = await request(app).get(`/api/employees/${employee.id}`).set(bearer(hrToken));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(employee);
    expect(Object.keys(res.body).sort()).toEqual([
      'annualBaseSalary',
      'country',
      'createdAt',
      'currency',
      'employeeCode',
      'fullName',
      'id',
      'jobTitle',
      'standardMonthlySalary',
      'status',
      'structure',
      'updatedAt',
    ]);
  });

  it('FR-EMP-06: always recalculates the standard monthly salary from current data', async () => {
    const { employee } = (await create(await prdEmployee())).body;
    await prisma.employee.update({
      where: { id: employee.id },
      data: { annualBaseSalary: '120000' },
    });

    const res = await request(app).get(`/api/employees/${employee.id}`).set(bearer(hrToken));
    expect(res.body.standardMonthlySalary.earnings[0].amount.amount).toBe('10000.00');
  });

  it('returns a clear "not found" for an employee that does not exist', async () => {
    const res = await request(app).get('/api/employees/99999').set(bearer(hrToken));
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Employee not found' });
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(app).get('/api/employees/EMP00001').set(bearer(hrToken));
    expect(res.status).toBe(400);
  });
});

describe('FR-AUTH-02: employee records are HR-only', () => {
  it('refuses employees, even for their own record', async () => {
    const { employee, password } = await createEmployeeAccount();
    const token = await loginAs(app, employee.employeeCode, password);

    expect(
      (await request(app).get(`/api/employees/${employee.id}`).set(bearer(token))).status,
    ).toBe(403);
    expect((await create(await prdEmployee(), token)).status).toBe(403);
    expect(await prisma.employee.count()).toBe(1);
  });

  it('requires login', async () => {
    expect(
      (
        await request(app)
          .post('/api/employees')
          .send(await prdEmployee())
      ).status,
    ).toBe(401);
  });
});
