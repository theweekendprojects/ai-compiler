import type { Context } from 'hono';
import { parseAic, compile } from '@ai-compiler/core';
import { z } from 'zod';
import type { Env } from '../types.js';

const schema = z.object({
  source: z.string().min(1),
  provider: z.enum(['anthropic', 'bedrock']).optional().default('anthropic'),
  model: z.string().optional(),
  enableCaching: z.boolean().optional().default(true),
});

export async function compileHandler(c: Context<{ Bindings: Env }>) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await c.req.json());
  } catch (err: any) {
    return c.json({ error: 'Invalid request', details: err.message }, 400);
  }

  try {
    const spec = parseAic(body.source);

    if (!spec.module) {
      return c.json({ error: 'Missing module declaration. Add: module <YourModuleName>' }, 400);
    }

    const bytecode = compile(spec, body.source, {
      provider: {
        provider: body.provider,
        model: body.model ?? (body.provider === 'bedrock' ? 'us.amazon.nova-micro-v1:0' : 'claude-opus-4-5'),
      },
      enableCaching: body.enableCaching,
    });

    return c.json(bytecode);
  } catch (err: any) {
    return c.json({ error: 'Compilation failed', details: err.message }, 500);
  }
}
