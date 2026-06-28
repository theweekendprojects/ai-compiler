/**
 * .aic source file parser
 *
 * .aic syntax:
 *
 *   module UserService
 *   version 1.0
 *
 *   context:
 *     REST API for managing users in PostgreSQL
 *
 *   tools: [database, http]
 *
 *   intent getAdultUsers:
 *     Get all users where age > 18, sorted by name ascending.
 *
 *     input:
 *       - none
 *
 *     output:
 *       - list of user objects (id, name, email, age)
 */

import type { AicSpec, AicIntent } from '../types/index.js';

export function parseAic(source: string): AicSpec {
  const lines = source.split('\n');
  const spec: AicSpec = {
    module: '',
    version: '1.0',
    context: '',
    tools: [],
    intents: [],
  };

  let current: AicIntent | null = null;
  let section: 'none' | 'context' | 'intent-body' | 'input' | 'output' = 'none';
  let buffer: string[] = [];

  const flushBuffer = () => {
    const text = buffer.join('\n').trim();
    buffer = [];
    return text;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // module declaration
    if (/^module\s+(.+)/i.test(trimmed)) {
      spec.module = trimmed.replace(/^module\s+/i, '').trim();
      continue;
    }

    // version declaration
    if (/^version\s+(.+)/i.test(trimmed)) {
      spec.version = trimmed.replace(/^version\s+/i, '').trim();
      continue;
    }

    // context block
    if (/^context\s*:/i.test(trimmed)) {
      section = 'context';
      continue;
    }

    // tools: [a, b, c]
    if (/^tools\s*:/i.test(trimmed)) {
      const match = trimmed.match(/\[(.+)\]/);
      if (match) {
        spec.tools = match[1].split(',').map(t => t.trim()).filter(Boolean);
      }
      section = 'none';
      continue;
    }

    // intent declaration
    if (/^intent\s+(\w+)\s*:/i.test(trimmed)) {
      if (current) {
        if (section === 'intent-body') current.description = flushBuffer();
        spec.intents.push(current);
      }
      current = {
        name: trimmed.replace(/^intent\s+/i, '').replace(/:$/, '').trim(),
        description: '',
        input: [],
        output: [],
      };
      section = 'intent-body';
      buffer = [];
      continue;
    }

    // input / output sub-sections inside intent
    if (current && /^input\s*:/i.test(trimmed)) {
      if (section === 'intent-body') current.description = flushBuffer();
      section = 'input';
      continue;
    }
    if (current && /^output\s*:/i.test(trimmed)) {
      if (section === 'intent-body') current.description = flushBuffer();
      section = 'output';
      continue;
    }

    // list items
    if (/^-\s+(.+)/.test(trimmed)) {
      const item = trimmed.replace(/^-\s+/, '').trim();
      if (section === 'input' && current) { current.input.push(item); continue; }
      if (section === 'output' && current) { current.output.push(item); continue; }
    }

    // context body text
    if (section === 'context' && trimmed) {
      buffer.push(trimmed);
      continue;
    }

    // intent body text
    if (section === 'intent-body' && current) {
      buffer.push(line);
      continue;
    }
  }

  // flush last context
  if (section === 'context') {
    spec.context = buffer.join(' ').trim();
  }

  // flush last intent
  if (current) {
    if (section === 'intent-body') current.description = flushBuffer();
    spec.intents.push(current);
  }

  return spec;
}
