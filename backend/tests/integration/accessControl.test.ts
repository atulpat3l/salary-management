import express from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { authenticate } from '../../src/middleware/authenticate';
import { errorHandler } from '../../src/middleware/errorHandler';
import { requireRole } from '../../src/middleware/requireRole';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createEmployeeAccount, createHrAccount } from '../helpers/factories';

/**
 * Real HR and self-service routes arrive in later steps; these probe routes use exactly the
 * same middleware so the access rules can be tested on their own now.
 */
const app = createApp();
const probe = express();
probe.get('/hr-only', authenticate, requireRole('HR'), (_req, res) => {
  res.json({ ok: true });
});
probe.get('/employee-only', authenticate, requireRole('EMPLOYEE'), (_req, res) => {
  res.json({ ok: true });
});
probe.get('/anyone', authenticate, requireRole('HR', 'EMPLOYEE'), (_req, res) => {
  res.json({ ok: true });
});
probe.get('/misconfigured', requireRole('HR'), (_req, res) => {
  res.json({ ok: true });
});
probe.use(errorHandler);

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function hrToken() {
  const { account, password } = await createHrAccount();
  return loginAs(app, account.loginId, password);
}

async function employeeToken() {
  const { employee, password } = await createEmployeeAccount();
  return loginAs(app, employee.employeeCode, password);
}

describe('FR-AUTH-02: role-based access', () => {
  it('lets HR reach HR routes', async () => {
    const res = await request(probe)
      .get('/hr-only')
      .set(bearer(await hrToken()));
    expect(res.status).toBe(200);
  });

  it('refuses employees on HR routes with 403, even when calling the URL directly', async () => {
    const res = await request(probe)
      .get('/hr-only')
      .set(bearer(await employeeToken()));
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You do not have access to this resource',
    });
  });

  it('refuses HR on employee self-service routes (HR has no payslips of its own)', async () => {
    const res = await request(probe)
      .get('/employee-only')
      .set(bearer(await hrToken()));
    expect(res.status).toBe(403);
  });

  it('allows any of several roles when a route lists more than one', async () => {
    for (const token of [await hrToken(), await employeeToken()]) {
      const res = await request(probe).get('/anyone').set(bearer(token));
      expect(res.status).toBe(200);
    }
  });

  it('asks for login (401), not "forbidden" (403), when there is no token', async () => {
    expect((await request(probe).get('/hr-only')).status).toBe(401);
  });

  it('fails closed (500) if a route forgets to authenticate before checking the role', async () => {
    const res = await request(probe).get('/misconfigured');
    expect(res.status).toBe(500);
  });
});
