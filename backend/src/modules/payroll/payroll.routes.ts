import { Router } from 'express';
import { idParamSchema } from '../../lib/schemas';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  createRunSchema,
  disburseSchema,
  listRunPayslipsQuerySchema,
  runPayslipParamsSchema,
  saveInputsSchema,
} from './payroll.schema';
import {
  calculateRun,
  createRun,
  disburseRun,
  finaliseRun,
  getRun,
  getRunPayslip,
  listInputs,
  listRunPayslips,
  listRuns,
  saveInputs,
} from './payroll.service';

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

payrollRouter.post('/:id/calculate', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await calculateRun(id));
});

// The confirmation step (FR-PAY-04) belongs to the UI; the API acts on an explicit POST.
payrollRouter.post('/:id/finalise', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await finaliseRun(id));
});

payrollRouter.post('/:id/disburse', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { paymentDate } = disburseSchema.parse(req.body);
  res.json(await disburseRun(id, paymentDate));
});

payrollRouter.get('/:id/payslips', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await listRunPayslips(id, listRunPayslipsQuerySchema.parse(req.query)));
});

payrollRouter.get('/:id/payslips/:payslipId', async (req, res) => {
  const { id, payslipId } = runPayslipParamsSchema.parse(req.params);
  res.json(await getRunPayslip(id, payslipId));
});
