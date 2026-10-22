import { Router } from 'express';
import { idParamSchema } from '../../lib/schemas';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { listStructuresQuerySchema } from './structures.schema';
import { getStructure, listStructures } from './structures.service';

export const structuresRouter = Router();

structuresRouter.use(authenticate, requireRole('HR'));

structuresRouter.get('/', async (req, res) => {
  const { country } = listStructuresQuerySchema.parse(req.query);
  res.json(await listStructures(country));
});

structuresRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await getStructure(id));
});
