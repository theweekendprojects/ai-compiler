import type { Context } from 'hono';
import { AiVM } from '@ai-compiler/core';
import type { AiopFile, StepExecutionResult } from '@ai-compiler/core';
import { z } from 'zod';
import type { Env } from '../types.js';

const schema = z.object({
  aiop: z.record(z.any()),
  inputs: z.record(z.string()).optional().default({}),
  provider: z.enum(['anthropic', 'bedrock', 'workers-ai']).optional(),
  model: z.string().optional(),
  simulate: z.boolean().optional().default(false),
});

export async function runHandler(c: Context<{ Bindings: Env }>) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await c.req.json());
  } catch (err: any) {
    return c.json({ error: 'Invalid request', details: err.issues ?? err.message }, 400);
  }

  const aiop = body.aiop as AiopFile;
  const provider = body.provider ?? aiop.steps[0]?.provider ?? 'anthropic';
  const model    = body.model    ?? aiop.steps[0]?.model;

  const vm = new AiVM({
    provider: { provider: provider as any, model: model ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
    simulate: body.simulate,
    workersAiBinding:   { accountId: c.env.CF_ACCOUNT_ID, apiToken: c.env.CF_API_TOKEN },
    anthropicApiKey:    c.env.ANTHROPIC_API_KEY,
    awsAccessKeyId:     c.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
    awsRegion:          c.env.AWS_REGION,
    cfGatewayUrl:       c.env.CF_GATEWAY_URL,
  });

  try {
    const result = await vm.run(aiop, body.inputs);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: 'Execution failed', details: err.message }, 500);
  }
}
