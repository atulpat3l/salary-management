import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { AppError } from '../../src/lib/errors';
import { errorHandler, notFoundHandler, zodFieldErrors } from '../../src/middleware/errorHandler';

/** A tiny app whose routes throw each kind of error the handler must understand. */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/app-error', () => {
    throw AppError.conflict('Payroll for 2026-09 already exists');
  });
  app.get('/app-error-fields', () => {
    throw AppError.validation('Invalid employee', { fullName: 'Full name is required' });
  });
  app.post('/zod', (req) => {
    z.object({ fullName: z.string().min(1), salary: z.number().positive() }).parse(req.body);
  });
  app.get('/async-crash', async () => {
    await Promise.resolve();
    throw new Error('database exploded at /secret/path');
  });
  app.post('/echo', (req, res) => {
    res.json(req.body);
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  const app = buildApp();

  it('returns the status, code and message of an AppError', async () => {
    const res = await request(app).get('/app-error');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'CONFLICT', message: 'Payroll for 2026-09 already exists' },
    });
  });

  it('includes field errors when an AppError carries them', async () => {
    const res = await request(app).get('/app-error-fields');
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ fullName: 'Full name is required' });
  });

  it('turns a ZodError into a 400 with one message per invalid field', async () => {
    const res = await request(app).post('/zod').send({ fullName: '', salary: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['fullName', 'salary']);
  });

  it('returns a generic 500 for unexpected (async) errors without leaking details', async () => {
    const res = await request(app).get('/async-crash');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('returns 400 INVALID_JSON for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Route GET /nope not found' });
  });
});

describe('zodFieldErrors', () => {
  it('uses dotted paths for nested fields and keeps only the first message per field', () => {
    const schema = z.object({
      inputs: z.array(z.object({ bonus: z.number().min(0).int() })),
    });
    const result = schema.safeParse({ inputs: [{ bonus: -1.5 }] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = zodFieldErrors(result.error);
      expect(Object.keys(fields)).toEqual(['inputs.0.bonus']);
    }
  });

  it('uses "_" for errors on the root value', () => {
    const result = z.object({}).safeParse('not an object');
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(zodFieldErrors(result.error))).toEqual(['_']);
  });
});
