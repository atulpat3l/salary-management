import { Router } from 'express';
import { idParamSchema } from '../../lib/schemas';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { createEmployeeSchema, updateEmployeeSchema } from './employees.schema';
import {
  createEmployee,
  deactivateEmployee,
  getEmployee,
  resetEmployeePassword,
  updateEmployee,
} from './employees.service';

export const employeesRouter = Router();

employeesRouter.use(authenticate, requireRole('HR'));

employeesRouter.post('/', async (req, res) => {
  res.status(201).json(await createEmployee(createEmployeeSchema.parse(req.body)));
});

employeesRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await getEmployee(id));
});

employeesRouter.patch('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await updateEmployee(id, updateEmployeeSchema.parse(req.body)));
});

// The confirmation step (FR-EMP-04) belongs to the UI; the API acts on an explicit POST.
employeesRouter.post('/:id/deactivate', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await deactivateEmployee(id));
});

employeesRouter.post('/:id/reset-password', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await resetEmployeePassword(id));
});
