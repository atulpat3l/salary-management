import request from 'supertest';
import { createApp } from '../../src/app';
import { signToken } from '../../src/modules/auth/token';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createEmployeeAccount, createHrAccount } from '../helpers/factories';

const app = createApp();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('POST /api/auth/login — FR-AUTH-01', () => {
  it('logs in HR and returns a token and the user, without any password data', async () => {
    const { account, password } = await createHrAccount();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ loginId: account.loginId, password });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({
      loginId: account.loginId,
      role: 'HR',
      mustChangePassword: false,
      employee: null,
    });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain(password);
    expect(body).not.toMatch(/\$2[aby]\$/); // no bcrypt hash
  });

  it('logs in an employee with their Employee ID and returns their identity', async () => {
    const { employee, password } = await createEmployeeAccount();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ loginId: employee.employeeCode, password });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      loginId: employee.employeeCode,
      role: 'EMPLOYEE',
      mustChangePassword: false,
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
      },
    });
  });

  it('accepts the Employee ID in any case and with surrounding spaces', async () => {
    const { employee, password } = await createEmployeeAccount();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ loginId: ` ${employee.employeeCode.toLowerCase()} `, password });
    expect(res.status).toBe(200);
  });

  it('creates one session per login', async () => {
    const { account, password } = await createHrAccount();
    await loginAs(app, account.loginId, password);
    await loginAs(app, account.loginId, password);
    expect(await prisma.session.count({ where: { accountId: account.id } })).toBe(2);
  });

  it('gives the same generic error for a wrong password and an unknown ID', async () => {
    const { account } = await createHrAccount();

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ loginId: account.loginId, password: 'wrong-password1' });
    const unknownId = await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'EMP99999', password: 'whatever1' });

    for (const res of [wrongPassword, unknownId]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid ID or password' },
      });
    }
    expect(await prisma.session.count()).toBe(0);
  });

  it('refuses a deactivated employee even with the right password', async () => {
    const { employee, password } = await createEmployeeAccount({ status: 'INACTIVE' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ loginId: employee.employeeCode, password });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('This account has been deactivated');
    expect(await prisma.session.count()).toBe(0);
  });

  it('returns field errors when the ID or password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ loginId: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({
      loginId: 'Employee ID is required',
      password: 'Password is required',
    });
  });
});

describe('authenticated requests — FR-AUTH-02', () => {
  it('GET /api/auth/me returns the logged-in user', async () => {
    const { employee, password } = await createEmployeeAccount();
    const token = await loginAs(app, employee.employeeCode, password);

    const res = await request(app).get('/api/auth/me').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.loginId).toBe(employee.employeeCode);
    expect(res.body.employee.fullName).toBe(employee.fullName);
  });

  it.each([
    ['no Authorization header', {}],
    ['a non-Bearer scheme', { Authorization: 'Basic abc' }],
    ['an empty Bearer token', { Authorization: 'Bearer ' }],
    ['a garbage token', { Authorization: 'Bearer not-a-jwt' }],
  ])('rejects a request with %s', async (_label, headers) => {
    const res = await request(app).get('/api/auth/me').set(headers);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a validly signed token whose session does not exist', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set(bearer(signToken('00000000-0000-0000-0000-000000000000')));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });
});

describe('sessions — FR-AUTH-03', () => {
  async function loggedInHr() {
    const { account, password } = await createHrAccount();
    const token = await loginAs(app, account.loginId, password);
    return { account, token };
  }

  it('logout ends the session, so the same token stops working', async () => {
    const { token } = await loggedInHr();

    const logout = await request(app).post('/api/auth/logout').set(bearer(token));
    expect(logout.status).toBe(204);

    const after = await request(app).get('/api/auth/me').set(bearer(token));
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('SESSION_EXPIRED');
    expect(await prisma.session.count()).toBe(0);
  });

  it('logout only ends the current session, not other logins', async () => {
    const { account, password } = await createHrAccount();
    const first = await loginAs(app, account.loginId, password);
    const second = await loginAs(app, account.loginId, password);

    await request(app).post('/api/auth/logout').set(bearer(first));

    expect((await request(app).get('/api/auth/me').set(bearer(second))).status).toBe(200);
  });

  it('logs the user out automatically after 30 minutes of inactivity', async () => {
    const { token } = await loggedInHr();
    await prisma.session.updateMany({ data: { lastActivityAt: minutesAgo(31) } });

    const res = await request(app).get('/api/auth/me').set(bearer(token));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
    expect(await prisma.session.count()).toBe(0);
  });

  it('keeps the session alive while the user is active', async () => {
    const { token } = await loggedInHr();
    await prisma.session.updateMany({ data: { lastActivityAt: minutesAgo(29) } });

    expect((await request(app).get('/api/auth/me').set(bearer(token))).status).toBe(200);

    const session = await prisma.session.findFirstOrThrow();
    expect(Date.now() - session.lastActivityAt.getTime()).toBeLessThan(5_000);
  });

  it('does not write to the database on every request (activity is refreshed at most once a minute)', async () => {
    const { token } = await loggedInHr();
    const recent = new Date(Date.now() - 10_000);
    await prisma.session.updateMany({ data: { lastActivityAt: recent } });

    await request(app).get('/api/auth/me').set(bearer(token));

    const session = await prisma.session.findFirstOrThrow();
    expect(session.lastActivityAt.getTime()).toBe(recent.getTime());
  });

  it('FR-EMP-04: ends an active session once the employee is deactivated', async () => {
    const { employee, password } = await createEmployeeAccount();
    const token = await loginAs(app, employee.employeeCode, password);

    await prisma.employee.update({ where: { id: employee.id }, data: { status: 'INACTIVE' } });

    const res = await request(app).get('/api/auth/me').set(bearer(token));
    expect(res.status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });
});
