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
  countryCode: string,
  jobTitle: string,
  annualBaseSalary: string,
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
) {
  const structure = await prisma.salaryStructure.findUniqueOrThrow({
    where: { name: `${countryCode} Standard` },
  });
  return prisma.employee.create({
    data: {
      employeeCode: `EMP${String(++codeSequence).padStart(5, '0')}`,
      fullName: `Employee ${codeSequence}`,
      jobTitle,
      countryCode,
      annualBaseSalary,
      structureId: structure.id,
      status,
    },
  });
}

/**
 * Hand-computed reference data for India (INR):
 *   Engineer 1,200,000.00 · Engineer 1,200,000.01 · Analyst 900,000.25
 *   (+ an inactive Engineer on 9,999,999.00, which must be ignored)
 *   min 900,000.25 · max 1,200,000.01
 *   mean (3,300,000.26 ÷ 3 = 1,100,000.0866…) → 1,100,000.09
 *   Engineer mean (2,400,000.01 ÷ 2 = 1,200,000.005) → 1,200,000.01 (half up)
 * Plus one US Engineer on USD 60,000, which must never mix with the INR figures.
 */
async function addReferenceEmployees() {
  await addEmployee('IN', 'Engineer', '1200000.00');
  await addEmployee('IN', 'Engineer', '1200000.01');
  await addEmployee('IN', 'Analyst', '900000.25');
  await addEmployee('IN', 'Engineer', '9999999.00', 'INACTIVE');
  await addEmployee('US', 'Engineer', '60000');
}

const get = (path: string, token = hrToken) => request(app).get(path).set(bearer(token));

beforeEach(async () => {
  await resetDb();
  await seedReferenceData();
  const { account, password } = await createHrAccount();
  hrToken = await loginAs(app, account.loginId, password);
});
afterAll(() => prisma.$disconnect());

describe('GET /api/insights/countries/:code — FR-INS-01', () => {
  it('shows min, max, average and headcount of active employees, in the country’s currency', async () => {
    await addReferenceEmployees();

    const res = await get('/api/insights/countries/in');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      country: { code: 'IN', name: 'India' },
      currency: 'INR',
      headcount: 3,
      minimum: { amount: '900000.25', currency: 'INR' },
      maximum: { amount: '1200000.01', currency: 'INR' },
      average: { amount: '1100000.09', currency: 'INR' },
      message: null,
    });
  });

  it('shows a clear message instead of zeros when the country has no active employees', async () => {
    await addEmployee('GB', 'Engineer', '50000', 'INACTIVE');

    const res = await get('/api/insights/countries/GB');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      country: { code: 'GB', name: 'United Kingdom' },
      currency: 'GBP',
      headcount: 0,
      minimum: null,
      maximum: null,
      average: null,
      message: 'There are no active employees in United Kingdom',
    });
  });

  it('always matches current records: edits and deactivations show immediately', async () => {
    const employee = await addEmployee('US', 'Engineer', '60000');
    await addEmployee('US', 'Engineer', '80000');
    expect((await get('/api/insights/countries/US')).body.average.amount).toBe('70000.00');

    await prisma.employee.update({
      where: { id: employee.id },
      data: { annualBaseSalary: '100000' },
    });
    expect((await get('/api/insights/countries/US')).body.average.amount).toBe('90000.00');

    await prisma.employee.update({ where: { id: employee.id }, data: { status: 'INACTIVE' } });
    expect((await get('/api/insights/countries/US')).body).toMatchObject({
      headcount: 1,
      average: { amount: '80000.00' },
    });
  });

  it('returns 404 for an unsupported country and 400 for a malformed code', async () => {
    expect((await get('/api/insights/countries/FR')).status).toBe(404);
    expect((await get('/api/insights/countries/FR')).body.error.message).toBe(
      'Country not supported',
    );
    expect((await get('/api/insights/countries/France')).status).toBe(400);
  });
});

describe('GET /api/insights/countries/:code/job-titles — FR-INS-02', () => {
  it('shows each job title with headcount and average, in the country’s currency', async () => {
    await addReferenceEmployees();

    const res = await get('/api/insights/countries/IN/job-titles');

    expect(res.status).toBe(200);
    expect(res.body.currency).toBe('INR');
    expect(
      res.body.jobTitles.map(
        (t: { jobTitle: string; headcount: number; average: { amount: string } }) => [
          t.jobTitle,
          t.headcount,
          t.average.amount,
        ],
      ),
    ).toEqual([
      ['Analyst', 1, '900000.25'],
      ['Engineer', 2, '1200000.01'], // the inactive Engineer is ignored
    ]);
    expect(res.body.jobTitles[1].average.currency).toBe('INR');
  });

  it('can be narrowed to one job title', async () => {
    await addReferenceEmployees();

    const res = await get('/api/insights/countries/IN/job-titles?jobTitle=Analyst');

    expect(res.body.jobTitles).toHaveLength(1);
    expect(res.body.jobTitles[0]).toMatchObject({ jobTitle: 'Analyst', headcount: 1 });
  });

  it('only includes titles from the chosen country', async () => {
    await addReferenceEmployees();
    const res = await get('/api/insights/countries/US/job-titles');
    expect(res.body.jobTitles).toEqual([
      expect.objectContaining({
        jobTitle: 'Engineer',
        headcount: 1,
        average: { amount: '60000.00', currency: 'USD' },
      }),
    ]);
  });

  it('shows a message when there is nothing to show', async () => {
    const res = await get('/api/insights/countries/DE/job-titles');
    expect(res.body).toMatchObject({
      jobTitles: [],
      message: 'There are no active employees in Germany',
    });
  });
});

describe('GET /api/insights/overview — FR-INS-03', () => {
  it('shows total headcount and one row per country, each in its own currency', async () => {
    await addReferenceEmployees();

    const res = await get('/api/insights/overview');

    expect(res.status).toBe(200);
    expect(res.body.headcount).toBe(4); // 3 IN + 1 US active
    expect(
      res.body.countries.map(
        (c: { country: { code: string }; currency: string; headcount: number }) => [
          c.country.code,
          c.currency,
          c.headcount,
        ],
      ),
    ).toEqual([
      ['AU', 'AUD', 0],
      ['CA', 'CAD', 0],
      ['DE', 'EUR', 0],
      ['IN', 'INR', 3],
      ['GB', 'GBP', 0],
      ['US', 'USD', 1],
    ]);
    const india = res.body.countries.find(
      (c: { country: { code: string } }) => c.country.code === 'IN',
    );
    expect(india).toMatchObject({
      minimum: { amount: '900000.25', currency: 'INR' },
      maximum: { amount: '1200000.01', currency: 'INR' },
      average: { amount: '1100000.09', currency: 'INR' },
    });
  });

  it('NFR-04: has no organisation-wide salary figure, because it would mix currencies', async () => {
    await addReferenceEmployees();
    const res = await get('/api/insights/overview');
    expect(Object.keys(res.body).sort()).toEqual(['countries', 'headcount']);
  });

  it('shows empty countries with nulls, not zeros', async () => {
    const res = await get('/api/insights/overview');
    expect(res.body.headcount).toBe(0);
    expect(res.body.countries[0]).toMatchObject({
      headcount: 0,
      minimum: null,
      maximum: null,
      average: null,
    });
  });
});

describe('FR-AUTH-02: insights are HR-only', () => {
  it('refuses employees and anonymous users', async () => {
    const { employee, password } = await createEmployeeAccount();
    const token = await loginAs(app, employee.employeeCode, password);
    for (const path of [
      '/api/insights/overview',
      '/api/insights/countries/US',
      '/api/insights/countries/US/job-titles',
    ]) {
      expect((await get(path, token)).status).toBe(403);
      expect((await request(app).get(path)).status).toBe(401);
    }
  });
});
