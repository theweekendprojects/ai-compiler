import type { Context } from 'hono';
import { parseAic, compile, AiVM } from '@ai-compiler/core';
import type { AiopFile, StepExecutionResult } from '@ai-compiler/core';
import { z } from 'zod';
import type { Env } from '../types.js';

const schema = z.object({
  aiop: z.record(z.any()).optional(),
  source: z.string().optional(),
  inputs: z.record(z.string()).optional().default({}),
  provider: z.enum(['anthropic', 'bedrock']).optional().default('anthropic'),
  model: z.string().optional(),
  simulate: z.boolean().optional().default(false),
  context: z.string().optional(),
});

/**
 * POST /stream
 * Streams step execution events as newline-delimited JSON (NDJSON).
 * Each line is a JSON object:
 *   { type: 'step_start',    step: { id, name } }
 *   { type: 'step_done',     step: StepExecutionResult }
 *   { type: 'workflow_done', result: WorkflowExecutionResult }
 *   { type: 'error',         message: string }
 *
 * Accepts either a pre-compiled aiop or raw source (compiles first).
 */
export async function streamHandler(c: Context<{ Bindings: Env }>) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await c.req.json());
  } catch (err: any) {
    return c.json({ error: 'Invalid request', details: err.issues ?? err.message }, 400);
  }

  if (!body.aiop && !body.source) {
    return c.json({ error: 'Provide either aiop or source' }, 400);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };

      try {
        // ── compile if source provided ──────────────────────────────────────
        let aiop: AiopFile;
        if (body.source) {
          send({ type: 'compiling' });
          const workflow = parseAic(body.source);
          aiop = await compile(workflow, body.source, {
            provider: { provider: body.provider, model: body.model ?? 'claude-opus-4-5' },
            context: body.context,
            anthropicApiKey:    c.env.ANTHROPIC_API_KEY,
            awsAccessKeyId:     c.env.AWS_ACCESS_KEY_ID,
            awsSecretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
            awsRegion:          c.env.AWS_REGION,
            cfGatewayUrl:       c.env.CF_GATEWAY_URL,
          });
          send({ type: 'compiled', aiop });
        } else {
          aiop = body.aiop as AiopFile;
        }

        // ── run step by step, streaming updates ────────────────────────────
        // We re-implement the loop here to stream each step event
        // rather than waiting for the full result.
        const { AiVM: AiVMClass } = await import('@ai-compiler/core');
        const vm = new AiVMClass({
          provider: { provider: body.provider, model: body.model ?? 'claude-opus-4-5' },
          simulate: body.simulate,
          anthropicApiKey:    c.env.ANTHROPIC_API_KEY,
          awsAccessKeyId:     c.env.AWS_ACCESS_KEY_ID,
          awsSecretAccessKey: c.env.AWS_SECRET_ACCESS_KEY,
          awsRegion:          c.env.AWS_REGION,
          cfGatewayUrl:       c.env.CF_GATEWAY_URL,
        });

        // Patch vm.run to stream — we call run() and it returns the full result
        // but we send step_start events manually before calling
        const startedAt = new Date().toISOString();
        const stepResults: StepExecutionResult[] = [];

        for (const step of aiop.steps) {
          send({ type: 'step_start', step: { id: step.id, name: step.name } });

          // run single step via vm
          const stepResult = await (vm as any).runStep(aiop, step, body.inputs, stepResults);
          stepResults.push(stepResult);

          send({ type: 'step_done', step: stepResult });

          if (stepResult.status === 'FAILED') break;
        }

        const status = stepResults.some(s => s.status === 'FAILED') ? 'FAILED'
          : stepResults.some(s => s.status === 'LOGGED') ? 'PARTIAL'
          : 'SUCCESS';

        send({
          type: 'workflow_done',
          result: {
            workflow: aiop.workflow,
            started_at: startedAt,
            completed_at: new Date().toISOString(),
            status,
            inputs: body.inputs,
            steps: stepResults,
          },
        });

      } catch (err: any) {
        send({ type: 'error', message: err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
