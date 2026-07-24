import type { ApiSignal } from '../../api';
import type { RenderSignal } from './types';

export function ownerSignal(signal: RenderSignal): ApiSignal | null {
  return 'config' in signal && 'refresh_seconds' in signal ? signal : null;
}
