#!/usr/bin/env node
import { program } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parseAic, compile, serializeBytecode } from '@ai-compiler/core';

program
  .name('aicompiler')
  .description('AI Compiler — compile .aic source to .aibc bytecode')
  .version('0.1.0');

program
  .command('compile <file>')
  .description('Compile a .aic source file to .aibc bytecode')
  .option('-o, --out <file>', 'Output .aibc file path')
  .option('-p, --provider <name>', 'Provider: anthropic | bedrock', 'anthropic')
  .option('-m, --model <name>', 'Model name')
  .option('--no-cache', 'Disable cache hints in bytecode')
  .action((file, options) => {
    const filePath = resolve(file);
    if (!existsSync(filePath)) {
      console.error(chalk.red(`File not found: ${filePath}`));
      process.exit(1);
    }

    const spinner = ora(`Compiling ${chalk.bold(basename(file))}...`).start();

    try {
      const source = readFileSync(filePath, 'utf8');
      const spec = parseAic(source);

      if (!spec.module) {
        spinner.fail(chalk.red('Missing module declaration'));
        console.error(chalk.dim('Add this to your .aic file: module <YourModuleName>'));
        process.exit(1);
      }

      const bytecode = compile(spec, source, {
        provider: {
          provider: options.provider,
          model: options.model,
        },
        enableCaching: options.cache !== false,
      });

      const outPath = options.out ?? filePath.replace(/\.aic$/, '.aibc');
      writeFileSync(outPath, serializeBytecode(bytecode), 'utf8');

      spinner.succeed(chalk.green(`Compiled → ${outPath}`));
      console.log(chalk.dim(`  Module:  ${bytecode.module}`));
      console.log(chalk.dim(`  Intents: ${bytecode.intents.length}`));
      console.log(chalk.dim(`  Hash:    ${bytecode.sourceHash}`));
    } catch (err: any) {
      spinner.fail(chalk.red('Compilation failed'));
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });

program.parse();
