import express from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { authenticate } from '../../src/middleware/authenticate';
import { errorHandler } from '../../src/middleware/errorHandler';
import { bearer, loginAs } from '../helpers/auth';
import { prisma, resetDb } from '../helpers/db';
import { createEmployeeAccount, createHrAccount } from '../helpers/factories';

const app = createApp();
const NEW_PASSWORD = 'BrandNew2026';

/** A stand-in for any ordinary protected route (e.g. "my payslips"). */
const protectedApp = express();
protectedApp.get('/protected', authenticate, (_req, res) => {
  res.json({ ok: true });
});
protectedApp.use(errorHandler);

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const changePassword = (token: string, body: object) =>
  request(app).post('/api/auth/change-password').set(bearer(token)).send(body);

describe('POST /api/auth/change-password — FR-AUTH-05', () => {
  it('changes the password: the new one works and the old one no longer does', async () => {
    const { employee, password } = await createEmployeeAccount();
    const token = await loginAs(app, employee.employeeCode, password);

    const res = await changePassword(token, {
      currentPassword: password,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(204);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ loginId: employee.employeeCode, password });
    expect(oldLogin.status).toBe(401);
    await expect(loginAs(app, employee.employeeCode, NEW_PASSWORD)).resolves.toEqual(
      expect.any(String),
    );
  });

  it('stores only a new hash, never the password itself — NFR-06', async () => {
    const { account, password } = await createHrAccount();
    const token = await loginAs(app, account.loginId, password);

    await changePassword(token, { currentPassword: password, newPassword: NEW_PASSWORD });

    const saved = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(saved.passwordHash).not.toBe(account.passwordHash);
    expect(saved.passwordHash).not.toContain(NEW_PASSWORD);
  });

  it('keeps the current session but ends every other session', async () => {
    const { account, password } = await createHrAccount();
    const current = await loginAs(app, account.loginId, password);
    const other = await loginAs(app, account.loginId, password);

    await changePassword(current, { currentPassword: password, newPassword: NEW_PASSWORD });

    expect((await request(app).get('/api/auth/me').set(bearer(current))).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(bearer(other))).status).toBe(401);
  });

  it('rejects a wrong current password with a field error and changes nothing', async () => {
    const { account, password } = await createHrAccount();
    const token = await loginAs(app, account.loginId, password);

    const res = await changePassword(token, {
      currentPassword: 'NotMyPassw0rd',
      newPassword: NEW_PASSWORD,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ currentPassword: 'Current password is incorrect' });
    await expect(loginAs(app, account.loginId, password)).resolves.toEqual(expect.any(String));
  });

  it.each([
    ['too short', 'Ab1', 'Password must be at least 8 characters'],
    ['no number', 'OnlyLetters', 'Password must contain at least one number'],
    ['no letter', '1234567890', 'Password must contain at least one letter'],
  ])('rejects a new password that is %s', async (_label, newPassword, message) => {
    const { account, password } = await createHrAccount();
    const token = await loginAs(app, account.loginId, password);

    const res = await changePassword(token, { currentPassword: password, newPassword });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.newPassword).toBe(message);
  });

  it('rejects reusing the current password', async () => {
    const { account, password } = await createHrAccount();
    const token = await loginAs(app, account.loginId, password);

    const res = await changePassword(token, { currentPassword: password, newPassword: password });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.newPassword).toBe(
      'New password must be different from the current password',
    );
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'x', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('forced change of a temporary password — FR-AUTH-04', () => {
  async function loginWithTemporaryPassword() {
    const { employee, password } = await createEmployeeAccount({ mustChangePassword: true });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ loginId: employee.employeeCode, password });
    return { employee, password, res, token: res.body.token as string };
  }

  it('login succeeds and tells the client a password change is required', async () => {
    const { res } = await loginWithTemporaryPassword();
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  it('blocks every other protected route until the password is changed', async () => {
    const { token } = await loginWithTemporaryPassword();

    const res = await request(protectedApp).get('/protected').set(bearer(token));

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must change your temporary password before continuing',
    });
  });

  it('still allows /me and logout while the change is pending', async () => {
    const { token } = await loginWithTemporaryPassword();

    const me = await request(app).get('/api/auth/me').set(bearer(token));
    expect(me.status).toBe(200);
    expect(me.body.mustChangePassword).toBe(true);

    expect((await request(app).post('/api/auth/logout').set(bearer(token))).status).toBe(204);
  });

  it('unlocks everything once the password is changed, in the same session', async () => {
    const { password, token } = await loginWithTemporaryPassword();

    await changePassword(token, { currentPassword: password, newPassword: NEW_PASSWORD });

    expect((await request(protectedApp).get('/protected').set(bearer(token))).status).toBe(200);
    const me = await request(app).get('/api/auth/me').set(bearer(token));
    expect(me.body.mustChangePassword).toBe(false);
  });
});
