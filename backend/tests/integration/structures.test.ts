import request from 'supertest';
import { seedReferenceData } from '../../prisma/seed/seedReferenceData';
import { createApp } from '../../src/app';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createEmployeeAccount, createHrAccount } from '../helpers/factories';

const app = createApp();
let hrToken: string;

beforeEach(async () => {
  await resetDb();
  await seedReferenceData();
  const { account, password } = await createHrAccount();
  hrToken = await loginAs(app, account.loginId, password);
});
afterAll(() => prisma.$disconnect());

const get = (path: string, token = hrToken) => request(app).get(path).set(bearer(token));

describe('GET /api/countries — FR-CUR-01', () => {
  it('lists the supported countries with their currency and locale, sorted by name', async () => {
    const res = await get('/api/countries');

    expect(res.status).toBe(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual([
      'Australia',
      'Canada',
      'Germany',
      'India',
      'United Kingdom',
      'United States',
    ]);
    expect(res.body).toContainEqual({
      code: 'IN',
      name: 'India',
      currencyCode: 'INR',
      locale: 'en-IN',
    });
  });
});

describe('GET /api/structures — FR-STR-01 / FR-STR-02', () => {
  it('lists every structure when no country is given', async () => {
    const res = await get('/api/structures');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(18);
  });

  it('FR-EMP-01: filters to one country, so only that country’s structures can be offered', async () => {
    const res = await get('/api/structures?country=in');

    expect(res.status).toBe(200);
    expect(res.body.map((s: { name: string }) => s.name)).toEqual([
      'IN Hourly',
      'IN Sales',
      'IN Standard',
    ]);
    expect(res.body.every((s: { currency: string }) => s.currency === 'INR')).toBe(true);
  });

  it('rejects an unsupported country with a field error', async () => {
    const res = await get('/api/structures?country=FR');
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ country: 'Not a supported country' });
  });

  it('rejects a malformed country code', async () => {
    const res = await get('/api/structures?country=USA');
    expect(res.status).toBe(400);
    expect(res.body.error.fields.country).toBe('Must be a two-letter country code');
  });
});

describe('GET /api/structures/:id — FR-STR-02', () => {
  async function idOf(name: string) {
    return (await prisma.salaryStructure.findUniqueOrThrow({ where: { name } })).id;
  }

  it('shows the full "US Standard" structure from the PRD, with currency on every fixed amount', async () => {
    const id = await idOf('US Standard');

    const res = await get(`/api/structures/${id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id,
      name: 'US Standard',
      style: 'STANDARD',
      country: { code: 'US', name: 'United States' },
      currency: 'USD',
      variableTargetPct: '10',
      standardMonthlyHours: 160,
      overtimeMultiplier: '1.5',
      earnings: [
        { name: 'Housing allowance', basis: 'PCT_BASE', percent: '40', amount: null },
        {
          name: 'Transport allowance',
          basis: 'FIXED',
          percent: null,
          amount: { amount: '200.00', currency: 'USD' },
        },
      ],
      deductions: [
        { name: 'Income tax', basis: 'PCT_GROSS', percent: '20', amount: null },
        { name: 'Retirement', basis: 'PCT_BASE', percent: '5', amount: null },
        {
          name: 'Health insurance',
          basis: 'FIXED',
          percent: null,
          amount: { amount: '100.00', currency: 'USD' },
        },
      ],
    });
  });

  it('FR-CUR-01: shows fixed amounts in the structure’s own currency', async () => {
    const res = await get(`/api/structures/${await idOf('DE Hourly')}`);
    expect(res.body.currency).toBe('EUR');
    const transport = res.body.earnings.find(
      (e: { name: string }) => e.name === 'Transport allowance',
    );
    expect(transport.amount).toEqual({ amount: '120.00', currency: 'EUR' });
    expect(res.body.variableTargetPct).toBe('0');
    expect(res.body.overtimeMultiplier).toBe('2');
  });

  it('returns 404 for a structure that does not exist', async () => {
    const res = await get('/api/structures/99999');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Salary structure not found');
  });

  it.each(['abc', '0', '-1', '1.5'])('returns 400 for the invalid id %j', async (id) => {
    const res = await get(`/api/structures/${id}`);
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('id');
  });
});

describe('FR-AUTH-02: countries and structures are HR-only', () => {
  it.each(['/api/countries', '/api/structures', '/api/structures/1'])(
    'refuses an employee on %s',
    async (path) => {
      const { employee, password } = await createEmployeeAccount();
      const token = await loginAs(app, employee.employeeCode, password);
      expect((await get(path, token)).status).toBe(403);
    },
  );

  it.each(['/api/countries', '/api/structures'])('requires login for %s', async (path) => {
    expect((await request(app).get(path)).status).toBe(401);
  });
});
