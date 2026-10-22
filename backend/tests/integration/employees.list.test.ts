import request from 'supertest';
import { seedReferenceData } from '../../prisma/seed/seedReferenceData';
import { createApp } from '../../src/app';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createEmployeeAccount, createHrAccount } from '../helpers/factories';

const app = createApp();
let hrToken: string;

interface Row {
  fullName: string;
  countryCode?: string;
  structure?: string;
  annualBaseSalary?: string;
  jobTitle?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

/** Inserts employees directly (fast); codes follow insertion order: EMP00001, EMP00002, … */
async function insertEmployees(rows: Row[]) {
  const structures = await prisma.salaryStructure.findMany();
  const idOf = (name: string) => structures.find((s) => s.name === name)!.id;
  let n = await prisma.employee.count();
  for (const row of rows) {
    const countryCode = row.countryCode ?? 'US';
    await prisma.employee.create({
      data: {
        employeeCode: `EMP${String(++n).padStart(5, '0')}`,
        fullName: row.fullName,
        jobTitle: row.jobTitle ?? 'Engineer',
        countryCode,
        annualBaseSalary: row.annualBaseSalary ?? '60000',
        structureId: idOf(row.structure ?? `${countryCode} Standard`),
        status: row.status ?? 'ACTIVE',
      },
    });
  }
}

const list = (query: Record<string, string | number> = {}) =>
  request(app).get('/api/employees').query(query).set(bearer(hrToken));

const names = (res: request.Response) =>
  res.body.items.map((e: { fullName: string }) => e.fullName);

beforeEach(async () => {
  await resetDb();
  await seedReferenceData();
  const { account, password } = await createHrAccount();
  hrToken = await loginAs(app, account.loginId, password);
});
afterAll(() => prisma.$disconnect());

describe('GET /api/employees — FR-FIND-01 browse', () => {
  it('returns one page of rows with the total count and paging info', async () => {
    await insertEmployees(Array.from({ length: 30 }, (_, i) => ({ fullName: `Person ${i + 1}` })));

    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 30, page: 1, pageSize: 25, totalPages: 2 });
    expect(res.body.items).toHaveLength(25);
    expect(res.body.items[0].employeeCode).toBe('EMP00001');
  });

  it('FR-EMP-06: each row shows base salary and standard monthly gross and net, with currency', async () => {
    await insertEmployees([{ fullName: 'Asha Rao', annualBaseSalary: '60000' }]);

    const [row] = (await list()).body.items;

    expect(row).toEqual({
      id: expect.any(Number),
      employeeCode: 'EMP00001',
      fullName: 'Asha Rao',
      jobTitle: 'Engineer',
      country: { code: 'US', name: 'United States' },
      currency: 'USD',
      annualBaseSalary: { amount: '60000.00', currency: 'USD' },
      // PRD §5.7 worked example 2
      standardMonthlyGross: { amount: '7700.00', currency: 'USD' },
      standardMonthlyNet: { amount: '5810.00', currency: 'USD' },
      status: 'ACTIVE',
    });
  });

  it('FR-CUR-01: shows each row in its own country’s currency', async () => {
    await insertEmployees([
      { fullName: 'US person', countryCode: 'US' },
      { fullName: 'IN person', countryCode: 'IN', annualBaseSalary: '1800000' },
      { fullName: 'DE person', countryCode: 'DE', annualBaseSalary: '55000' },
    ]);

    const currencies = (await list()).body.items.map(
      (e: { currency: string; standardMonthlyNet: { currency: string } }) => [
        e.currency,
        e.standardMonthlyNet.currency,
      ],
    );
    expect(currencies).toEqual([
      ['USD', 'USD'],
      ['INR', 'INR'],
      ['EUR', 'EUR'],
    ]);
  });

  it('returns later pages and an empty page past the end', async () => {
    await insertEmployees(Array.from({ length: 12 }, (_, i) => ({ fullName: `Person ${i + 1}` })));

    const page2 = await list({ page: 2, pageSize: 5 });
    expect(page2.body.items.map((e: { employeeCode: string }) => e.employeeCode)).toEqual([
      'EMP00006',
      'EMP00007',
      'EMP00008',
      'EMP00009',
      'EMP00010',
    ]);

    const past = await list({ page: 9, pageSize: 5 });
    expect(past.body).toMatchObject({ items: [], total: 12, totalPages: 3 });
  });

  it('returns an empty list (not an error) when there are no employees', async () => {
    expect((await list()).body).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    });
  });

  it('rejects invalid paging', async () => {
    expect((await list({ pageSize: 500 })).status).toBe(400);
    expect((await list({ page: 0 })).status).toBe(400);
  });
});

describe('GET /api/employees — FR-FIND-02 search', () => {
  beforeEach(() =>
    insertEmployees([
      { fullName: 'Asha Rao' },
      { fullName: 'Rahul Sharma' },
      { fullName: 'Maria Rossi' },
      { fullName: 'Asha Patel' },
    ]),
  );

  it('matches part of a name, ignoring case', async () => {
    expect(names(await list({ q: 'asha' }))).toEqual(['Asha Rao', 'Asha Patel']);
    expect(names(await list({ q: 'rOSSi' }))).toEqual(['Maria Rossi']);
    expect(names(await list({ q: 'ra' }))).toEqual(['Asha Rao', 'Rahul Sharma']);
  });

  it('accepts names with apostrophes, hyphens and accents', async () => {
    await insertEmployees([{ fullName: "Seán O'Brien-Müller" }]);
    expect(names(await list({ q: "O'Brien-Mü" }))).toEqual(["Seán O'Brien-Müller"]);
  });

  it('matches an Employee ID, in any case', async () => {
    expect(names(await list({ q: 'emp00003' }))).toEqual(['Maria Rossi']);
  });

  it('returns no rows (total 0) when nothing matches', async () => {
    expect((await list({ q: 'Nobody' })).body).toMatchObject({ items: [], total: 0 });
  });

  it('rejects wildcard characters instead of letting them match everyone', async () => {
    for (const q of ['%', '_', 'a%b']) {
      const res = await list({ q });
      expect(res.status).toBe(400);
      expect(res.body.error.fields.q).toBe(
        'Search can only contain letters, numbers, spaces, apostrophes, hyphens and dots',
      );
    }
  });
});

describe('GET /api/employees — FR-FIND-03 filters', () => {
  beforeEach(() =>
    insertEmployees([
      { fullName: 'Asha Rao', countryCode: 'IN', jobTitle: 'Engineer' },
      { fullName: 'Asha Patel', countryCode: 'US', jobTitle: 'Engineer' },
      { fullName: 'Ravi Kumar', countryCode: 'IN', jobTitle: 'Designer' },
      { fullName: 'Asha Gupta', countryCode: 'IN', jobTitle: 'Engineer', status: 'INACTIVE' },
    ]),
  );

  it('filters by country', async () => {
    expect(names(await list({ country: 'in' }))).toEqual(['Asha Rao', 'Ravi Kumar', 'Asha Gupta']);
  });

  it('filters by job title', async () => {
    expect(names(await list({ jobTitle: 'Designer' }))).toEqual(['Ravi Kumar']);
  });

  it('filters by status', async () => {
    expect(names(await list({ status: 'INACTIVE' }))).toEqual(['Asha Gupta']);
    expect((await list({ status: 'ACTIVE' })).body.total).toBe(3);
  });

  it('combines every filter with the search', async () => {
    const res = await list({ q: 'asha', country: 'IN', jobTitle: 'Engineer', status: 'ACTIVE' });
    expect(names(res)).toEqual(['Asha Rao']);
    expect(res.body.total).toBe(1);
  });
});

describe('GET /api/employees — FR-FIND-04 sorting', () => {
  it('sorts the whole list by name, not just the current page', async () => {
    await insertEmployees(['Zoe', 'Mia', 'Ana', 'Lee', 'Bob'].map((fullName) => ({ fullName })));

    expect(names(await list({ sort: 'name', pageSize: 2 }))).toEqual(['Ana', 'Bob']);
    expect(names(await list({ sort: 'name', pageSize: 2, page: 3 }))).toEqual(['Zoe']);
    expect(names(await list({ sort: 'name', order: 'desc', pageSize: 2 }))).toEqual(['Zoe', 'Mia']);
  });

  it('sorts by salary numerically within one country', async () => {
    await insertEmployees([
      { fullName: 'Mid', annualBaseSalary: '60000' },
      { fullName: 'Low', annualBaseSalary: '9000.50' },
      { fullName: 'High', annualBaseSalary: '100000' },
      { fullName: 'Other country', countryCode: 'IN', annualBaseSalary: '5000000' },
    ]);

    expect(names(await list({ country: 'US', sort: 'salary' }))).toEqual(['Low', 'Mid', 'High']);
    expect(names(await list({ country: 'US', sort: 'salary', order: 'desc' }))).toEqual([
      'High',
      'Mid',
      'Low',
    ]);
  });

  it('refuses to sort by salary across countries, explaining why', async () => {
    const res = await list({ sort: 'salary' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.sort).toMatch(/different currencies cannot be compared/);
  });

  it('keeps a stable order for equal names, so paging never repeats or skips a row', async () => {
    await insertEmployees(Array.from({ length: 6 }, () => ({ fullName: 'Same Name' })));
    const page1 = (await list({ sort: 'name', pageSize: 3 })).body.items;
    const page2 = (await list({ sort: 'name', pageSize: 3, page: 2 })).body.items;
    const codes = [...page1, ...page2].map((e: { employeeCode: string }) => e.employeeCode);
    expect(new Set(codes).size).toBe(6);
  });
});

describe('GET /api/employees/job-titles', () => {
  it('lists distinct job titles, sorted, optionally for one country', async () => {
    await insertEmployees([
      { fullName: 'A', jobTitle: 'Engineer', countryCode: 'US' },
      { fullName: 'B', jobTitle: 'Analyst', countryCode: 'IN' },
      { fullName: 'C', jobTitle: 'Engineer', countryCode: 'IN' },
    ]);

    const all = await request(app).get('/api/employees/job-titles').set(bearer(hrToken));
    expect(all.body).toEqual(['Analyst', 'Engineer']);

    const us = await request(app).get('/api/employees/job-titles?country=US').set(bearer(hrToken));
    expect(us.body).toEqual(['Engineer']);
  });
});

describe('FR-AUTH-02: the employee list is HR-only', () => {
  it('refuses employees and anonymous users', async () => {
    const { employee, password } = await createEmployeeAccount();
    const token = await loginAs(app, employee.employeeCode, password);

    expect((await request(app).get('/api/employees').set(bearer(token))).status).toBe(403);
    expect((await request(app).get('/api/employees/job-titles').set(bearer(token))).status).toBe(
      403,
    );
    expect((await request(app).get('/api/employees')).status).toBe(401);
  });
});
