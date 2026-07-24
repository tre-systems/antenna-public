import type { ConnectorRequestRecord, TemplateRecord } from '@antenna/shared';

import { fetchJson } from './http';

export function getConnectorRequests(): Promise<ConnectorRequestRecord[]> {
  return fetchJson<ConnectorRequestRecord[]>('/api/requests');
}

export function getTemplates(): Promise<TemplateRecord[]> {
  return fetchJson<TemplateRecord[]>('/api/templates');
}
