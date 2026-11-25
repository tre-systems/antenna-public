import { bodyLimit } from 'hono/body-limit';

export const apiBodyLimit = () =>
  bodyLimit({
    maxSize: 256 * 1024,
    onError: (c) => c.json({ error: 'invalid_body' }, 413),
  });
