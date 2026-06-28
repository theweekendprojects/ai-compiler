import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compileHandler } from './handlers/compile.js';
import { runHandler } from './handlers/run.js';
import { streamHandler } from './handlers/stream.js';
import type { Env } from './types.js';

const app = new Hono<{ Bindings: Env }>();

// CORS — open for web demo
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => c.json({ name: 'aivm-worker', version: '0.1.0', status: 'ok' }));

// POST /compile  — .aic source → .aibc bytecode (JSON)
app.post('/compile', compileHandler);

// POST /run      — .aibc bytecode → execute all intents, return results
app.post('/run', runHandler);

// POST /stream   — .aibc bytecode + intentName → stream single intent output
app.post('/stream', streamHandler);

// POST /compile-run — convenience: .aic source → compile + run in one step
app.post('/compile-run', async (c) => {
  // reuse handlers by delegating internally
  const body = await c.req.json();
  c.req.raw.bodyUsed; // mark as used

  // compile first
  const compileReq = new Request(c.req.url.replace('/compile-run', '/compile'), {
    method: 'POST',
    headers: c.req.raw.headers,
    body: JSON.stringify(body),
  });
  const compileRes = await app.fetch(compileReq, c.env);
  const bytecode = await compileRes.json();

  if (!compileRes.ok) return c.json(bytecode, compileRes.status as any);

  // run with compiled bytecode
  const runReq = new Request(c.req.url.replace('/compile-run', '/run'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bytecode, inputs: body.inputs ?? {} }),
  });
  return app.fetch(runReq, c.env);
});

export default { fetch: app.fetch };
