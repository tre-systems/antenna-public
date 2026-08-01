// One in-memory SSE fan-out per collection, addressed with idFromName(collectionId).

const KEEPALIVE_MS = 20_000;
const SSE_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache, no-transform',
  // Prevent intermediaries from buffering long-lived SSE chunks.
  'x-accel-buffering': 'no',
  connection: 'keep-alive',
} as const;

const encoder = new TextEncoder();

export type SseEvent = Readonly<Record<string, unknown>>;

// Exported because the SSE byte format is easier to test outside the DO API.
export const encodeSseChunk = (event: SseEvent): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

export const encodeSseKeepalive = (): Uint8Array => encoder.encode(`:keepalive\n\n`);

type Writer = {
  readonly controller: ReadableStreamDefaultController<Uint8Array>;
  readonly keepalive: ReturnType<typeof setInterval>;
  closed: boolean;
};

export class CollectionChannel implements DurableObject {
  private readonly writers = new Set<Writer>();

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(_state: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/subscribe') {
      return this.subscribe();
    }
    if (request.method === 'POST' && url.pathname === '/notify') {
      const event: unknown = await request.json().catch(() => null);
      if (!isRecord(event)) return new Response('invalid_event', { status: 400 });
      this.fanout(event);
      return new Response('ok');
    }
    return new Response('not_found', { status: 404 });
  }

  private subscribe(): Response {
    let writer: Writer | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        writer = {
          controller,
          keepalive: setInterval(() => {
            if (writer) this.sendKeepalive(writer);
          }, KEEPALIVE_MS),
          closed: false,
        };
        this.writers.add(writer);
        // Prime the connection so the browser flips into "open" state.
        this.safeEnqueue(writer, encodeSseKeepalive());
      },
      cancel: () => {
        if (writer) this.closeWriter(writer);
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  private fanout(event: SseEvent): void {
    const chunk = encodeSseChunk(event);
    for (const writer of this.writers) {
      this.safeEnqueue(writer, chunk);
    }
    this.dropClosedWriters();
  }

  private sendKeepalive(writer: Writer): void {
    this.safeEnqueue(writer, encodeSseKeepalive());
  }

  private safeEnqueue(writer: Writer, bytes: Uint8Array): void {
    if (writer.closed) return;
    try {
      writer.controller.enqueue(bytes);
    } catch {
      // `enqueue` throws if the stream was already closed by the reader.
      this.closeWriter(writer);
    }
  }

  private dropClosedWriters(): void {
    for (const writer of this.writers) {
      if (writer.controller.desiredSize === null) this.closeWriter(writer);
    }
  }

  private closeWriter(writer: Writer): void {
    if (writer.closed) return;
    writer.closed = true;
    clearInterval(writer.keepalive);
    this.writers.delete(writer);
  }
}

const isRecord = (value: unknown): value is SseEvent =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
