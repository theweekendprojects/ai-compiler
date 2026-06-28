/**
 * .aic → .aibc compiler
 *
 * Takes a parsed AicSpec and produces AibcBytecode.
 * This is the step where we can enrich the spec with:
 *   - resolved tool bindings
 *   - provider/model assignments per intent
 *   - cache hints
 *   - retry policies
 *   - source hash (for deterministic re-runs)
 */

import { createHash } from 'crypto';
import type { AicSpec, AibcBytecode, AibcIntent, ProviderConfig } from '../types/index.js';

export interface CompilerOptions {
  provider?: ProviderConfig;
  defaultRetryCount?: number;
  enableCaching?: boolean;
}

export function compile(spec: AicSpec, source: string, options: CompilerOptions = {}): AibcBytecode {
  const sourceHash = createHash('sha256').update(source).digest('hex').slice(0, 16);

  const intents: AibcIntent[] = spec.intents.map((intent) => {
    // resolve which tools this intent actually needs
    // heuristic: scan description for tool keywords
    const resolvedTools = spec.tools.filter(tool =>
      intent.description.toLowerCase().includes(tool.toLowerCase()) ||
      intent.name.toLowerCase().includes(tool.toLowerCase())
    );

    return {
      id: `${spec.module}.${intent.name}`,
      name: intent.name,
      description: intent.description,
      input: intent.input,
      output: intent.output,
      resolvedTools: resolvedTools.length > 0 ? resolvedTools : spec.tools,
      provider: options.provider?.provider,
      model: options.provider?.model,
      cacheHint: options.enableCaching ?? true,
      retryCount: options.defaultRetryCount ?? 2,
    };
  });

  return {
    version: '1.0',
    module: spec.module,
    context: spec.context,
    tools: spec.tools,
    compiledAt: new Date().toISOString(),
    sourceHash,
    intents,
  };
}

export function serializeBytecode(bytecode: AibcBytecode): string {
  return JSON.stringify(bytecode, null, 2);
}

export function deserializeBytecode(raw: string): AibcBytecode {
  return JSON.parse(raw) as AibcBytecode;
}
