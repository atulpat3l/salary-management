import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middleware/errorHandler';
import { createLoginRateLimiter } from '../../src/middleware/loginRateLimiter';

describe('login rate limiter', () => {
  function buildApp(max: number) {
    const app = express();
    app.post('/login', createLoginRateLimiter(max), (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);
    return app;
  }

  it('allows attempts up to the limit, then answers 429 in the standard error shape', async () => {
    const app = buildApp(2);
    expect((await request(app).post('/login')).status).toBe(200);
    expect((await request(app).post('/login')).status).toBe(200);

    const blocked = await request(app).post('/login');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('tells clients how much quota is left', async () => {
    const res = await request(buildApp(5)).post('/login');
    expect(res.headers['ratelimit']).toMatch(/remaining=4/);
  });

  it('keeps a separate count for each limiter instance', async () => {
    const first = buildApp(1);
    await request(first).post('/login');
    expect((await request(first).post('/login')).status).toBe(429);
    expect((await request(buildApp(1)).post('/login')).status).toBe(200);
  });
});
