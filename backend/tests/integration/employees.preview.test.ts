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

const preview = (body: object, token = hrToken) =>
  request(app).post('/api/employees/salary-preview').set(bearer(token)).send(body);

beforeEach(async () => {
  await resetDb();
  await seedReferenceData();
  const { account, password } = await createHrAccount();
  hrToken = await loginAs(app, account.loginId, password);
});
afterAll(() => prisma.$disconnect());

describe('POST /api/employees/salary-preview — FR-EMP-06 live preview', () => {
  it('returns the standard monthly salary for unsaved values (PRD worked example 2)', async () => {
    const res = await preview({
      countryCode: 'US',
      annualBaseSalary: '60000',
      structureId: await structureId('US Standard'),
    });

    expect(res.status).toBe(200);
    expect(res.body.currency).toBe('USD');
    expect(res.body.standardMonthlySalary).toMatchObject({
      gross: { amount: '7700.00', currency: 'USD' },
      totalDeductions: { amount: '1890.00', currency: 'USD' },
      net: { amount: '5810.00', currency: 'USD' },
      flagged: false,
    });
    expect(res.body.standardMonthlySalary.earnings).toHaveLength(4);
  });

  it('matches what is shown once the employee is saved with the same values', async () => {
    const values = {
      countryCode: 'IN',
      annualBaseSalary: '1234567.89',
      structureId: await structureId('IN Sales'),
    };

    const previewed = (await preview(values)).body.standardMonthlySalary;
    const created = await request(app)
      .post('/api/employees')
      .set(bearer(hrToken))
      .send({ ...values, fullName: 'Asha Rao', jobTitle: 'Account Executive' });

    expect(created.body.employee.standardMonthlySalary).toEqual(previewed);
  });

  it('updates as the inputs change: salary, structure or country', async () => {
    const usSales = await structureId('US Sales');
    const base = await preview({
      countryCode: 'US',
      annualBaseSalary: '60000',
      structureId: usSales,
    });
    const higher = await preview({
      countryCode: 'US',
      annualBaseSalary: '90000',
      structureId: usSales,
    });
    expect(Number(higher.body.standardMonthlySalary.net.amount)).toBeGreaterThan(
      Number(base.body.standardMonthlySalary.net.amount),
    );

    const inr = await preview({
      countryCode: 'IN',
      annualBaseSalary: '60000',
      structureId: await structureId('IN Standard'),
    });
    expect(inr.body.currency).toBe('INR');
  });

  it('saves nothing', async () => {
    await preview({
      countryCode: 'US',
      annualBaseSalary: '60000',
      structureId: await structureId('US Standard'),
    });
    expect(await prisma.employee.count()).toBe(0);
  });

  it('applies the same validation as saving: structure must match the country', async () => {
    const res = await preview({
      countryCode: 'US',
      annualBaseSalary: '60000',
      structureId: await structureId('GB Standard'),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({
      structureId: 'Choose a salary structure for United States',
    });
  });

  it('applies the same validation as saving: salary rules', async () => {
    const res = await preview({
      countryCode: 'US',
      annualBaseSalary: '12.345',
      structureId: await structureId('US Standard'),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({
      annualBaseSalary: 'Annual base salary can have at most two decimal places',
    });
  });

  it('does not need a name or job title', async () => {
    const res = await preview({
      countryCode: 'US',
      annualBaseSalary: '60000',
      structureId: await structureId('US Standard'),
    });
    expect(res.status).toBe(200);
  });

  it('is HR-only', async () => {
    const { employee, password } = await createEmployeeAccount();
    const token = await loginAs(app, employee.employeeCode, password);
    expect((await preview({}, token)).status).toBe(403);
  });
});
