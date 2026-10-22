import type { Express } from 'express';
import request from 'supertest';

/** Logs in through the real endpoint and returns the bearer token. */
export async function loginAs(app: Express, loginId: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ loginId, password });
  if (res.status !== 200) {
    throw new Error(`Login as ${loginId} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
