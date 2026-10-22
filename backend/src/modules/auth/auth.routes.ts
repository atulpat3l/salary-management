import { Router } from 'express';
import { env } from '../../config/env';
import { authenticate, getAuth } from '../../middleware/authenticate';
import { createLoginRateLimiter } from '../../middleware/loginRateLimiter';
import { loginSchema } from './auth.schema';
import { getCurrentUser, login, logout } from './auth.service';

export function createAuthRouter() {
  const router = Router();

  router.post('/login', createLoginRateLimiter(env.LOGIN_RATE_LIMIT), async (req, res) => {
    res.json(await login(loginSchema.parse(req.body)));
  });

  router.post('/logout', authenticate, async (req, res) => {
    await logout(getAuth(req).sessionId);
    res.status(204).end();
  });

  router.get('/me', authenticate, async (req, res) => {
    res.json(await getCurrentUser(getAuth(req).accountId));
  });

  return router;
}
