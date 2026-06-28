/**
 * .aic language parser
 *
 * Parses the Markdown-based .aic workflow format into a structured AicWorkflow.
 *
 * Expected format:
 *
 *   # Workflow: <Name>
 *
 *   ## Description
 *   <paragraph>
 *
 *   ## Inputs
 *   - inputName: description
 *
 *   ## Tools
 *   - toolName: description
 *
 *   ## Steps
 *
 *   ### 1. <StepName>
 *   Plain English description.
 *   Reference inputs as {inputName}.
 *   Reference previous step outputs as {StepName.field}.
 */

import type { AicWorkflow, AicStep } from '../types/index.js';

export function parseAic(source: string): AicWorkflow {
  const lines = source.split('\n');

  const workflow: AicWorkflow = {
    name: '',
    description: '',
    inputs: {},
    tools: {},
    steps: [],
  };

  type Section = 'none' | 'description' | 'inputs' | 'tools' | 'steps';
  let section: Section = 'none';
  let currentStep: AicStep | null = null;
  let buffer: string[] = [];

  const flushBuffer = () => {
    const text = buffer.join('\n').trim();
    buffer = [];
    return text;
  };

  const saveCurrentStep = () => {
    if (currentStep) {
      currentStep.description = flushBuffer();
      workflow.steps.push(currentStep);
      currentStep = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // H1 — workflow name
    if (/^# Workflow:\s*(.+)/i.test(trimmed)) {
      workflow.name = trimmed.replace(/^# Workflow:\s*/i, '').trim();
      continue;
    }

    // H2 — top-level sections
    if (/^## Description/i.test(trimmed)) {
      saveCurrentStep();
      section = 'description';
      buffer = [];
      continue;
    }
    if (/^## Inputs/i.test(trimmed)) {
      if (section === 'description') workflow.description = flushBuffer();
      saveCurrentStep();
      section = 'inputs';
      continue;
    }
    if (/^## Tools/i.test(trimmed)) {
      saveCurrentStep();
      section = 'tools';
      continue;
    }
    if (/^## Steps/i.test(trimmed)) {
      saveCurrentStep();
      section = 'steps';
      continue;
    }

    // H3 — individual step inside ## Steps
    if (section === 'steps' && /^### \d+\.\s+(.+)/.test(trimmed)) {
      saveCurrentStep();
      const name = trimmed.replace(/^### \d+\.\s+/, '').trim();
      currentStep = { name, description: '' };
      buffer = [];
      continue;
    }

    // List items — inputs and tools
    if (/^-\s+(.+)/.test(trimmed)) {
      const item = trimmed.replace(/^-\s+/, '').trim();
      const colonIdx = item.indexOf(':');
      if (colonIdx > -1) {
        const key = item.slice(0, colonIdx).trim();
        const val = item.slice(colonIdx + 1).trim();
        if (section === 'inputs') { workflow.inputs[key] = val; continue; }
        if (section === 'tools')  { workflow.tools[key] = val; continue; }
      }
    }

    // Body text
    if (section === 'description' && trimmed) {
      buffer.push(trimmed);
      continue;
    }
    if (section === 'steps' && currentStep && trimmed) {
      buffer.push(line);
      continue;
    }
  }

  // flush last step / description
  saveCurrentStep();
  if (section === 'description' && buffer.length) {
    workflow.description = flushBuffer();
  }

  return workflow;
}
