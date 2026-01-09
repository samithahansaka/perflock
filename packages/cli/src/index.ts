/**
 * perflock CLI - Performance contracts for React components
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { reportCommand } from './commands/report.js';

const program = new Command();

program
  .name('perflock')
  .description('Lock in your React component performance budgets')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize performance contracts configuration')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--typescript', 'Use TypeScript configuration (default)', true)
  .option('--javascript', 'Use JavaScript configuration')
  .action(initCommand);

// Run command
program
  .command('run')
  .description('Run performance tests')
  .option('-c, --config <path>', 'Path to configuration file')
  .option(
    '-t, --testMatch <pattern>',
    'Test file pattern',
    '**/*.perf.{ts,tsx,js,jsx}'
  )
  .option('--contract <name>', 'Run tests only for a specific contract')
  .option('--runs <number>', 'Number of test runs', '10')
  .option('--json', 'Output results as JSON')
  .option('--markdown', 'Output results as Markdown')
  .option('-o, --output <path>', 'Output file path')
  .action(runCommand);

// Report command
program
  .command('report')
  .description('Generate report from results')
  .option('-i, --input <path>', 'Path to results JSON file')
  .option('-f, --format <format>', 'Output format (json, markdown)', 'markdown')
  .option('-o, --output <path>', 'Output file path')
  .option('--compare <path>', 'Compare with baseline results')
  .action(reportCommand);

// Compare command
program
  .command('compare')
  .description('Compare current results with baseline')
  .option('--current <path>', 'Path to current results')
  .option('--baseline <path>', 'Path to baseline results')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    console.log('Compare command - coming soon');
    console.log('Options:', options);
  });

// Analyze command (for static analysis)
program
  .command('analyze <file>')
  .description('Analyze a component file for performance issues')
  .option('--fix', 'Show suggested fixes')
  .action(async (file, options) => {
    console.log('Analyze command - coming soon');
    console.log('File:', file);
    console.log('Options:', options);
  });

program.parse();
