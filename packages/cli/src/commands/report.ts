/**
 * Report command - Generate reports from results
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  isValidJsonReport,
  generateMarkdownReport,
  generateJsonReport,
  TestReport,
} from '@samithahansaka/perflock';

interface ReportOptions {
  input?: string;
  format?: 'json' | 'markdown';
  output?: string;
  compare?: string;
}

export async function reportCommand(options: ReportOptions): Promise<void> {
  const spinner = ora('Loading results...').start();

  try {
    // Find input file
    const inputPath = options.input || findLatestResults();

    if (!inputPath) {
      spinner.fail(chalk.red('No results file found'));
      console.log('');
      console.log(chalk.gray('Specify an input file with --input <path>'));
      console.log(chalk.gray('Or run tests first: npx perflock run'));
      process.exit(1);
    }

    if (!fs.existsSync(inputPath)) {
      spinner.fail(chalk.red(`Results file not found: ${inputPath}`));
      process.exit(1);
    }

    // Load results
    spinner.text = 'Parsing results...';
    const content = fs.readFileSync(inputPath, 'utf-8');
    let report: TestReport;

    try {
      const parsed = JSON.parse(content);
      if (!isValidJsonReport(parsed)) {
        throw new Error('Invalid report format');
      }
      report = parsed;
    } catch {
      spinner.fail(chalk.red('Invalid results file format'));
      process.exit(1);
    }

    spinner.succeed(`Loaded results from: ${inputPath}`);

    // Load comparison baseline if provided
    let _baselineReport: TestReport | undefined;
    if (options.compare) {
      spinner.start('Loading baseline for comparison...');

      if (!fs.existsSync(options.compare)) {
        spinner.fail(chalk.red(`Baseline file not found: ${options.compare}`));
        process.exit(1);
      }

      try {
        const baselineContent = fs.readFileSync(options.compare, 'utf-8');
        const parsed = JSON.parse(baselineContent);
        if (!isValidJsonReport(parsed)) {
          throw new Error('Invalid baseline format');
        }
        _baselineReport = parsed;
        spinner.succeed('Loaded baseline');
      } catch {
        spinner.fail(chalk.red('Invalid baseline file format'));
        process.exit(1);
      }
    }

    // Generate output
    const format = options.format || 'markdown';
    let output: string;

    if (format === 'json') {
      output = generateJsonReport(report.results, { prettyPrint: true });
    } else {
      output = generateMarkdownReport(report.results, {
        includeSuggestions: true,
        includePassingComponents: true,
      });
    }

    // Write or print output
    if (options.output) {
      fs.writeFileSync(options.output, output, 'utf-8');
      console.log(chalk.green(`Report written to: ${options.output}`));
    } else {
      console.log('');
      console.log(output);
    }

    // Print summary
    console.log('');
    console.log(chalk.bold('Summary:'));
    console.log(
      chalk.gray(
        `  Status: ${getStatusColor(report.status)(report.status.toUpperCase())}`
      )
    );
    console.log(
      chalk.gray(`  Components tested: ${report.summary.componentsTested}`)
    );
    console.log(chalk.green(`  Passed: ${report.summary.contractsPassed}`));
    if (report.summary.contractsWarning > 0) {
      console.log(
        chalk.yellow(`  Warnings: ${report.summary.contractsWarning}`)
      );
    }
    if (report.summary.contractsFailed > 0) {
      console.log(chalk.red(`  Failed: ${report.summary.contractsFailed}`));
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to generate report'));
    console.error(error);
    process.exit(1);
  }
}

/**
 * Find the most recent results file
 */
function findLatestResults(): string | null {
  const searchPaths = [
    '.perf-contracts/results.json',
    '.perf-contracts/latest.json',
    'perf-results.json',
  ];

  for (const searchPath of searchPaths) {
    const fullPath = path.join(process.cwd(), searchPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Look for any .json files in .perf-contracts
  const perfContractsDir = path.join(process.cwd(), '.perf-contracts');
  if (fs.existsSync(perfContractsDir)) {
    const files = fs
      .readdirSync(perfContractsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({
        name: f,
        path: path.join(perfContractsDir, f),
        mtime: fs.statSync(path.join(perfContractsDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length > 0) {
      return files[0].path;
    }
  }

  return null;
}

/**
 * Get chalk color function for status
 */
function getStatusColor(status: string): typeof chalk.green {
  switch (status) {
    case 'pass':
      return chalk.green;
    case 'warn':
      return chalk.yellow;
    case 'fail':
      return chalk.red;
    default:
      return chalk.gray;
  }
}
