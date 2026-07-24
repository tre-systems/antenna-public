import { Hono } from 'hono';
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

export const signalsRoute = new Hono<SignalsEnv>()
  .get('/', listSignals)
  .get('/:id', getSignal)
  .get('/:id/history', getSignalHistory)
  .post('/:id/refresh', refreshSignal)
  .patch('/:id', updateSignal)
  .delete('/:id', deleteSignal);
