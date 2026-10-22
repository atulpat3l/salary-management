import { Router } from 'express';
import { z } from 'zod';
import { countryCodeSchema } from '../../lib/schemas';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { getCountryInsights, getJobTitleInsights, getOverview } from './insights.service';

const countryParamsSchema = z.object({ code: countryCodeSchema });
const jobTitleQuerySchema = z.object({
  jobTitle: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
});

export const insightsRouter = Router();

insightsRouter.use(authenticate, requireRole('HR'));

insightsRouter.get('/overview', async (_req, res) => {
  res.json(await getOverview());
});

insightsRouter.get('/countries/:code', async (req, res) => {
  const { code } = countryParamsSchema.parse(req.params);
  res.json(await getCountryInsights(code));
});

insightsRouter.get('/countries/:code/job-titles', async (req, res) => {
  const { code } = countryParamsSchema.parse(req.params);
  const { jobTitle } = jobTitleQuerySchema.parse(req.query);
  res.json(await getJobTitleInsights(code, jobTitle));
});
