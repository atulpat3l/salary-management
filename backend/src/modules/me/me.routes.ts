import { Router, type Request } from 'express';
import { AppError } from '../../lib/errors';
import { idParamSchema } from '../../lib/schemas';
import { authenticate, getAuth } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { getMyPayslip, getMyProfile, listMyDisbursements, listMyPayslips } from './me.service';

export const meRouter = Router();

meRouter.use(authenticate, requireRole('EMPLOYEE'));

/** The logged-in employee's own id: always from the session, never from the request. */
function myEmployeeId(req: Request): number {
  const { employeeId } = getAuth(req);
  if (employeeId === null) throw AppError.forbidden();
  return employeeId;
}

meRouter.get('/', async (req, res) => {
  res.json(await getMyProfile(myEmployeeId(req)));
});

meRouter.get('/payslips', async (req, res) => {
  res.json(await listMyPayslips(myEmployeeId(req)));
});

meRouter.get('/payslips/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await getMyPayslip(myEmployeeId(req), id));
});

meRouter.get('/disbursements', async (req, res) => {
  res.json(await listMyDisbursements(myEmployeeId(req)));
});
