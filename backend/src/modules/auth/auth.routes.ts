import { Router } from 'express';
import { env } from '../../config/env';
import { authenticateAllowingPasswordChange, getAuth } from '../../middleware/authenticate';
import { createLoginRateLimiter } from '../../middleware/loginRateLimiter';
import { changePasswordSchema, loginSchema } from './auth.schema';
import { changePassword, getCurrentUser, login, logout } from './auth.service';

export function createAuthRouter() {
  const router = Router();

  router.post('/login', createLoginRateLimiter(env.LOGIN_RATE_LIMIT), async (req, res) => {
    res.json(await login(loginSchema.parse(req.body)));
  });

  // The routes below stay usable while a password change is pending (FR-AUTH-04),
  // so the user can see why, change it, or log out.
  router.post('/logout', authenticateAllowingPasswordChange, async (req, res) => {
    await logout(getAuth(req).sessionId);
    res.status(204).end();
  });

  router.get('/me', authenticateAllowingPasswordChange, async (req, res) => {
    res.json(await getCurrentUser(getAuth(req).accountId));
  });

  router.post('/change-password', authenticateAllowingPasswordChange, async (req, res) => {
    await changePassword(getAuth(req), changePasswordSchema.parse(req.body));
    res.status(204).end();
  });

  return router;
}
