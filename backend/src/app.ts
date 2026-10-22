import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createAuthRouter } from './modules/auth/auth.routes';
import { countriesRouter } from './modules/countries/countries.routes';
import { employeesRouter } from './modules/employees/employees.routes';
import { insightsRouter } from './modules/insights/insights.routes';
import { meRouter } from './modules/me/me.routes';
import { payrollRouter } from './modules/payroll/payroll.routes';
import { structuresRouter } from './modules/structures/structures.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'ok' });
  });

  app.use('/api/auth', createAuthRouter());
  app.use('/api/countries', countriesRouter);
  app.use('/api/structures', structuresRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/payroll-runs', payrollRouter);
  app.use('/api/me', meRouter);
  app.use('/api/insights', insightsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
