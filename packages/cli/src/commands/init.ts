/**
 * Init command - Initialize performance contracts configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';

interface InitOptions {
  force?: boolean;
  typescript?: boolean;
  javascript?: boolean;
}

const TYPESCRIPT_CONFIG = `import { defineContracts } from '@samithahansaka/perflock';

export default defineContracts({
  global: {
    // Number of test runs for statistical stability
    runs: 10,
    warmupRuns: 1,

    // Compare against rolling average of last N runs
    historyWindow: 20,

    // Regression threshold (15% = warn/fail)
    regressionThreshold: 0.15,

    // Output directory for results
    outputDir: '.perf-contracts',

    // Enable fix suggestions
    diagnostics: {
      enabled: true,
      suggestFixes: true,
      sourceDir: 'src',
    },
  },

  components: {
    // Example component contract
    // Uncomment and customize for your components

    // Button: {
    //   maxRenderTime: 8,      // ms
    //   maxRenderCount: 2,     // per scenario
    //   warningThreshold: 0.8, // warn at 80% of budget
    // },

    // UserCard: {
    //   maxRenderTime: 16,
    //   maxRenderCount: 3,
    //   interactions: {
    //     click: { maxRenders: 2 },
    //     type: { maxRenders: 1 },
    //   },
    // },

    // DataTable: {
    //   maxRenderTime: 100,
    //   maxRenderCount: 10,
    // },
  },

  // Optional: Group components for aggregate contracts
  // aggregates: {
  //   'checkout-flow': {
  //     components: ['CartItem', 'CartSummary', 'PaymentForm'],
  //     maxTotalRenderTime: 50,
  //   },
  // },
});
`;

const JAVASCRIPT_CONFIG = `// @ts-check
const { defineContracts } = require('@samithahansaka/perflock');

module.exports = defineContracts({
  global: {
    // Number of test runs for statistical stability
    runs: 10,
    warmupRuns: 1,

    // Compare against rolling average of last N runs
    historyWindow: 20,

    // Regression threshold (15% = warn/fail)
    regressionThreshold: 0.15,

    // Output directory for results
    outputDir: '.perf-contracts',

    // Enable fix suggestions
    diagnostics: {
      enabled: true,
      suggestFixes: true,
      sourceDir: 'src',
    },
  },

  components: {
    // Example component contract
    // Uncomment and customize for your components

    // Button: {
    //   maxRenderTime: 8,      // ms
    //   maxRenderCount: 2,     // per scenario
    //   warningThreshold: 0.8, // warn at 80% of budget
    // },
  },
});
`;

const EXAMPLE_TEST = `/**
 * Example performance test file
 * Place this in __perf__/Example.perf.tsx or similar
 */

import { measureInteraction, interactions } from '@samithahansaka/perflock';
import { render, fireEvent } from '@testing-library/react';

// Import your component
// import { YourComponent } from '../src/components/YourComponent';

describe('YourComponent Performance', () => {
  it('meets performance contract', async () => {
    // Create a measurement helper with testing library dependencies
    const measure = async (element: React.ReactElement, opts: any) => {
      const { measureInteraction } = await import('@samithahansaka/perflock');
      return measureInteraction(element, opts, { render, fireEvent });
    };

    // Example: Uncomment and customize
    // const result = await measure(
    //   <YourComponent prop="value" />,
    //   {
    //     interactions: [
    //       interactions.click('[data-testid="button"]'),
    //       interactions.type('[data-testid="input"]', 'test'),
    //     ],
    //     contract: 'YourComponent',
    //   }
    // );

    // expect(result).toPassContract();

    // Or use individual assertions:
    // expect(result.metrics.renderCount).toBeLessThanOrEqual(5);
    // expect(result.metrics.averageRenderTime).toBeLessThanOrEqual(16);
  });
});
`;

const GITIGNORE_ADDITIONS = `
# React Perf Contracts
.perf-contracts/
*.perf-results.json
`;

export async function initCommand(options: InitOptions): Promise<void> {
  const spinner = ora('Initializing @samithahansaka/perflock...').start();

  try {
    const cwd = process.cwd();
    const useTypeScript = !options.javascript;
    const configFileName = useTypeScript
      ? 'perf.contracts.ts'
      : 'perf.contracts.js';
    const configPath = path.join(cwd, configFileName);

    // Check if config already exists
    if (fs.existsSync(configPath) && !options.force) {
      spinner.fail(
        chalk.red(`Configuration file already exists: ${configFileName}`)
      );
      console.log(
        chalk.yellow('Use --force to overwrite existing configuration')
      );
      process.exit(1);
    }

    // Create config file
    spinner.text = 'Creating configuration file...';
    const configContent = useTypeScript ? TYPESCRIPT_CONFIG : JAVASCRIPT_CONFIG;
    fs.writeFileSync(configPath, configContent, 'utf-8');

    // Create __perf__ directory
    const perfDir = path.join(cwd, '__perf__');
    if (!fs.existsSync(perfDir)) {
      fs.mkdirSync(perfDir, { recursive: true });
    }

    // Create example test file
    const exampleTestPath = path.join(perfDir, 'Example.perf.tsx');
    if (!fs.existsSync(exampleTestPath)) {
      fs.writeFileSync(exampleTestPath, EXAMPLE_TEST, 'utf-8');
    }

    // Update .gitignore
    const gitignorePath = path.join(cwd, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignoreContent.includes('.perf-contracts/')) {
        spinner.text = 'Updating .gitignore...';
        fs.appendFileSync(gitignorePath, GITIGNORE_ADDITIONS, 'utf-8');
      }
    }

    spinner.succeed(chalk.green('Initialized @samithahansaka/perflock!'));

    console.log('');
    console.log(chalk.bold('Created files:'));
    console.log(chalk.gray(`  ${configFileName}`));
    console.log(chalk.gray('  __perf__/Example.perf.tsx'));
    console.log('');
    console.log(chalk.bold('Next steps:'));
    console.log(
      chalk.gray('  1. Edit perf.contracts.ts to define your component budgets')
    );
    console.log(
      chalk.gray('  2. Create performance tests in __perf__/ directory')
    );
    console.log(chalk.gray('  3. Run: npx @samithahansaka/perflock run'));
    console.log('');
    console.log(
      chalk.blue(
        'Documentation: https://github.com/your-org/@samithahansaka/perflock'
      )
    );
  } catch (error) {
    spinner.fail(chalk.red('Failed to initialize'));
    console.error(error);
    process.exit(1);
  }
}
