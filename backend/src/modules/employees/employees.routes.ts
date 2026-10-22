import { Router } from 'express';
import { idParamSchema } from '../../lib/schemas';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { createEmployeeSchema } from './employees.schema';
import { createEmployee, getEmployee } from './employees.service';

export const employeesRouter = Router();

employeesRouter.use(authenticate, requireRole('HR'));

employeesRouter.post('/', async (req, res) => {
  res.status(201).json(await createEmployee(createEmployeeSchema.parse(req.body)));
});

employeesRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await getEmployee(id));
});
