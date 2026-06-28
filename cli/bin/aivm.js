#!/usr/bin/env node
import { program } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { deserializeBytecode, AiVM } from '@ai-compiler/core';

program
  .name('aivm')
  .description('AI VM — execute .aibc bytecode via LLM')
  .version('0.1.0');

program
  .command('run <file>')
  .description('Execute all intents in a .aibc bytecode file')
  .option('-p, --provider <name>', 'Override provider: anthropic | bedrock')
  .option('-m, --model <name>', 'Override model name')
  .option('-i, --intent <name>', 'Run a single intent by name')
  .action(async (file, options) => {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.AWS_ACCESS_KEY_ID) {
      console.error(chalk.red('Error: Set ANTHROPIC_API_KEY or AWS credentials'));
      process.exit(1);
    }

    const filePath = resolve(file);
    if (!existsSync(filePath)) {
      console.error(chalk.red(`File not found: ${filePath}`));
      process.exit(1);
    }

    const raw = readFileSync(filePath, 'utf8');
    const bytecode = deserializeBytecode(raw);

    const provider = options.provider ?? bytecode.intents[0]?.provider ?? 'anthropic';
    const model = options.model ?? bytecode.intents[0]?.model;

    const vm = new AiVM({
      provider,
      model,
      cfGatewayUrl: process.env.CF_GATEWAY_URL,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      awsRegion: process.env.AWS_REGION ?? 'eu-west-1',
    });

    const intentsToRun = options.intent
      ? bytecode.intents.filter(i => i.name === options.intent)
      : bytecode.intents;

    if (!intentsToRun.length) {
      console.error(chalk.red(`Intent '${options.intent}' not found`));
      process.exit(1);
    }

    console.log(chalk.cyan(`\nAI VM — ${bytecode.module}`));
    console.log(chalk.dim(`Provider: ${provider} / Model: ${model ?? 'default'}`));
    console.log(chalk.dim(`Running ${intentsToRun.length} intent(s)\n`));

    for (const intent of intentsToRun) {
      const spinner = ora(`Executing: ${chalk.bold(intent.name)}`).start();
      try {
        const result = await vm.execute(bytecode, intent.name);
        spinner.succeed(chalk.green(`${intent.name} ${chalk.dim(`(${result.tokensUsed} tokens, ${result.durationMs}ms)`)}`));
        console.log(chalk.dim('─'.repeat(60)));
        console.log(result.output);
        console.log(chalk.dim('─'.repeat(60)) + '\n');
      } catch (err: any) {
        spinner.fail(chalk.red(`${intent.name} failed: ${err.message}`));
        process.exit(1);
      }
    }
  });

program.parse();
