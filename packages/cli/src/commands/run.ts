/**
 * Run command - Execute performance tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import {
  getConfig,
  generateJsonReport,
  generateMarkdownReport,
  ValidationResult,
} from '@samithahansaka/perflock';

interface RunOptions {
  config?: string;
  testMatch?: string;
  contract?: string;
  runs?: string;
  json?: boolean;
  markdown?: boolean;
  output?: string;
}

export async function runCommand(options: RunOptions): Promise<void> {
  const spinner = ora('Loading configuration...').start();

  try {
    // Load configuration
    const config = await getConfig(
      options.config ? path.dirname(options.config) : undefined
    );

    spinner.text = 'Finding test files...';

    // Find test files
    const testPattern = options.testMatch || '**/*.perf.{ts,tsx,js,jsx}';
    const testFiles = await glob(testPattern, {
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
      cwd: process.cwd(),
    });

    if (testFiles.length === 0) {
      spinner.warn(
        chalk.yellow('No test files found matching: ' + testPattern)
      );
      console.log('');
      console.log(
        chalk.gray('Create performance tests in __perf__/ directory')
      );
      console.log(chalk.gray('Example: __perf__/MyComponent.perf.tsx'));
      return;
    }

    spinner.text = `Found ${testFiles.length} test file(s)`;
    spinner.succeed();

    console.log('');
    console.log(chalk.bold('Test files:'));
    for (const file of testFiles) {
      console.log(chalk.gray(`  ${file}`));
    }
    console.log('');

    // Run tests
    spinner.start('Running performance tests...');

    const results: ValidationResult[] = [];
    const runs = parseInt(options.runs || '10', 10);

    // Note: In a real implementation, this would spawn a test runner (Jest/Vitest)
    // For now, we'll show a placeholder
    spinner.info(
      chalk.yellow('Note: Test execution requires Jest/Vitest integration')
    );
    console.log('');
    console.log(chalk.gray('To run tests manually:'));
    console.log(chalk.gray(`  npx vitest run ${testPattern}`));
    console.log(chalk.gray('  OR'));
    console.log(chalk.gray(`  npx jest ${testPattern}`));
    console.log('');

    // Generate output
    if (results.length > 0) {
      if (options.json) {
        const jsonOutput = generateJsonReport(results);
        if (options.output) {
          fs.writeFileSync(options.output, jsonOutput, 'utf-8');
          console.log(chalk.green(`JSON report written to: ${options.output}`));
        } else {
          console.log(jsonOutput);
        }
      } else if (options.markdown) {
        const mdOutput = generateMarkdownReport(results);
        if (options.output) {
          fs.writeFileSync(options.output, mdOutput, 'utf-8');
          console.log(
            chalk.green(`Markdown report written to: ${options.output}`)
          );
        } else {
          console.log(mdOutput);
        }
      }
    }

    // Summary
    console.log(chalk.bold('Configuration:'));
    console.log(chalk.gray(`  Runs per test: ${runs}`));
    console.log(
      chalk.gray(`  Components with contracts: ${config.components.size}`)
    );
    console.log('');

    if (config.components.size === 0) {
      console.log(chalk.yellow('No component contracts defined.'));
      console.log(
        chalk.gray('Edit perf.contracts.ts to add component budgets.')
      );
    } else {
      console.log(chalk.bold('Defined contracts:'));
      for (const [name, contract] of config.components) {
        const budgets: string[] = [];
        if (contract.maxRenderTime !== Infinity) {
          budgets.push(`${contract.maxRenderTime}ms`);
        }
        if (contract.maxRenderCount !== Infinity) {
          budgets.push(`${contract.maxRenderCount} renders`);
        }
        console.log(
          chalk.gray(`  ${name}: ${budgets.join(', ') || 'no limits'}`)
        );
      }
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to run tests'));
    console.error(error);
    process.exit(1);
  }
}
