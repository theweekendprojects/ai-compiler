import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compileHandler } from './handlers/compile.js';
import { runHandler } from './handlers/run.js';
import { streamHandler } from './handlers/stream.js';
import type { Env } from './types.js';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', c => c.json({ name: 'aivm-worker', version: '0.1.0', status: 'ok' }));

// POST /compile  — .aic source → .aix bytecode
app.post('/compile', compileHandler);

// POST /run      — .aix + inputs → full execution result
app.post('/run', runHandler);

// POST /stream   — .aic source or .aix → NDJSON step-by-step execution stream
app.post('/stream', streamHandler);

export default { fetch: app.fetch };
