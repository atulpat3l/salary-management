import { Router } from 'express';
import { idParamSchema } from '../../lib/schemas';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  createEmployeeSchema,
  jobTitlesQuerySchema,
  listEmployeesQuerySchema,
  salaryPreviewSchema,
  updateEmployeeSchema,
} from './employees.schema';
import {
  createEmployee,
  deactivateEmployee,
  getEmployee,
  listEmployees,
  listJobTitles,
  previewStandardSalary,
  resetEmployeePassword,
  updateEmployee,
} from './employees.service';

export const employeesRouter = Router();

employeesRouter.use(authenticate, requireRole('HR'));

employeesRouter.get('/', async (req, res) => {
  res.json(await listEmployees(listEmployeesQuerySchema.parse(req.query)));
});

employeesRouter.post('/', async (req, res) => {
  res.status(201).json(await createEmployee(createEmployeeSchema.parse(req.body)));
});

// Fixed paths are registered before "/:id" so they are not read as an id.
employeesRouter.get('/job-titles', async (req, res) => {
  const { country } = jobTitlesQuerySchema.parse(req.query);
  res.json(await listJobTitles(country));
});

employeesRouter.post('/salary-preview', async (req, res) => {
  res.json(await previewStandardSalary(salaryPreviewSchema.parse(req.body)));
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
