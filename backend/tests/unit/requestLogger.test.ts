import express, { Router } from 'express';
import request from 'supertest';
import { logger } from '../../src/lib/logger';
import { requestLogger } from '../../src/middleware/requestLogger';

describe('requestLogger', () => {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);
  const router = Router();
  router.post('/login', (_req, res) => {
    res.status(401).end();
  });
  app.use('/api/auth', router);

  it('logs the full path, status and duration — not the router-relative path or query string', async () => {
    const http = jest.spyOn(logger, 'http').mockImplementation(() => logger);

    await request(app).post('/api/auth/login?next=/secret').send({ password: 'Passw0rd1' });

    expect(http).toHaveBeenCalledTimes(1);
    expect(http.mock.calls[0][0]).toMatch(/^POST \/api\/auth\/login 401 \d+\.\dms$/);
  });

  it('NFR-06: never logs the request body', async () => {
    const http = jest.spyOn(logger, 'http').mockImplementation(() => logger);

    await request(app).post('/api/auth/login').send({ password: 'Passw0rd1' });

    expect(JSON.stringify(http.mock.calls)).not.toContain('Passw0rd1');
  });
});
