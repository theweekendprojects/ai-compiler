import type { Context } from 'hono';
import { AiVM } from '@ai-compiler/core';
import { z } from 'zod';
import type { Env } from '../types.js';

const schema = z.object({
  bytecode: z.record(z.any()),
  inputs: z.record(z.record(z.string())).optional().default({}),
  provider: z.enum(['anthropic', 'bedrock']).optional(),
  model: z.string().optional(),
});

export async function runHandler(c: Context<{ Bindings: Env }>) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await c.req.json());
  } catch (err: any) {
    return c.json({ error: 'Invalid request', details: err.message }, 400);
  }

  const provider = body.provider ?? (body.bytecode.intents?.[0]?.provider ?? 'anthropic');
  const model = body.model ?? body.bytecode.intents?.[0]?.model;

  const vm = new AiVM({
    provider: provider as any,
    model,
    cfGatewayUrl: c.env.CF_GATEWAY_URL,
    anthropicApiKey: c.env.ANTHROPIC_API_KEY,
    awsAccessKeyId: c.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: c.env.AWS_REGION,
  });

  try {
    const result = await vm.executeAll(body.bytecode as any, body.inputs);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: 'Execution failed', details: err.message }, 500);
  }
}
