import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { listCountries } from './countries.service';

export const countriesRouter = Router();

countriesRouter.use(authenticate, requireRole('HR'));

countriesRouter.get('/', async (_req, res) => {
  res.json(await listCountries());
});
