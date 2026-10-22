import { Router } from 'express';
import { idParamSchema } from '../../lib/schemas';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { createRunSchema, saveInputsSchema } from './payroll.schema';
import { createRun, getRun, listInputs, listRuns, saveInputs } from './payroll.service';

export const payrollRouter = Router();

payrollRouter.use(authenticate, requireRole('HR'));

payrollRouter.get('/', async (_req, res) => {
  res.json(await listRuns());
});

payrollRouter.post('/', async (req, res) => {
  const { month } = createRunSchema.parse(req.body);
  res.status(201).json(await createRun(month));
});

payrollRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await getRun(id));
});

payrollRouter.get('/:id/inputs', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await listInputs(id));
});

payrollRouter.put('/:id/inputs', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { inputs } = saveInputsSchema.parse(req.body);
  res.json(await saveInputs(id, inputs));
});
