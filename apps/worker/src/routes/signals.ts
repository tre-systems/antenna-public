import { Hono } from 'hono';
import { createSignalMutationRateLimit } from './public-read-rate-limit';
import {
  deleteSignal,
  getSignal,
  getSignalHistory,
  listSignals,
  refreshSignal,
  updateSignal,
} from './signals/handlers';
import type { SignalsEnv } from './signals/types';

export { latestPointsForSignals } from './signals/latest-points';
export { buildSignal } from './signals/read-model';

const mutationLimit = createSignalMutationRateLimit();

export const signalsRoute = new Hono<SignalsEnv>()
  .get('/', listSignals)
  .get('/:id', getSignal)
  .get('/:id/history', getSignalHistory)
  .post('/:id/refresh', mutationLimit, refreshSignal)
  .patch('/:id', mutationLimit, updateSignal)
  .delete('/:id', deleteSignal);
