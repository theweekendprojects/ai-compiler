import type { Context } from 'hono';
import { parseAic, compile } from '@ai-compiler/core';
import { z } from 'zod';
import type { Env } from '../types.js';

const schema = z.object({
  source: z.string().min(1, 'source is required'),
  provider: z.enum(['anthropic', 'bedrock', 'workers-ai']).optional().default('workers-ai'),
  model: z.string().optional(),
  context: z.string().optional(), // content of context.md
});

export async function compileHandler(c: Context<{ Bindings: Env }>) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await c.req.json());
  } catch (err: any) {
    return c.json({ error: 'Invalid request', details: err.issues ?? err.message }, 400);
  }

  try {
    const workflow = parseAic(body.source);

    if (!workflow.name) {
      return c.json({
        error: 'Missing workflow name. Add: # Workflow: <YourWorkflowName>',
      }, 400);
    }

    if (!workflow.steps.length) {
      return c.json({
        error: 'No steps found. Add a ## Steps section with ### 1. StepName blocks.',
      }, 400);
    }

    const aix = await compile(workflow, body.source, {
      provider: {
        provider: body.provider,
        model: body.model ?? (body.provider === 'workers-ai'
          ? '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
          : 'claude-opus-4-5'),
      },
      context: body.context,
      workersAiBinding: { accountId: c.env.CF_ACCOUNT_ID, apiToken: c.env.CF_API_TOKEN },
      anthropicApiKey:    c.env.ANTHROPIC_API_KEY,
      awsAccessKeyId:     c.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
      awsRegion:          c.env.AWS_REGION,
      cfGatewayUrl:       c.env.CF_GATEWAY_URL,
    });

    return c.json(aix);
  } catch (err: any) {
    return c.json({ error: 'Compilation failed', details: err.message }, 500);
  }
}
