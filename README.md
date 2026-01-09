# @samithahansaka/perflock

[![CI](https://github.com/samithahansaka/perflock/actions/workflows/ci.yml/badge.svg)](https://github.com/samithahansaka/perflock/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@samithahansaka/perflock.svg)](https://www.npmjs.com/package/@samithahansaka/perflock)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Lock in your React component performance budgets with CI enforcement.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [CLI Commands](#cli-commands)
- [GitHub Action](#github-action)
- [Packages](#packages)
- [Contributing](#contributing)
- [Author](#author)
- [License](#license)

## Features

- Define performance contracts for React components
- Measure render times and render counts during interactions
- Jest/Vitest matchers for assertions
- CLI for running tests and generating reports
- GitHub Action for CI integration with PR comments
- Regression detection against historical baselines

## Installation

```bash
npm install @samithahansaka/perflock --save-dev
```

## Quick Start

### 1. Initialize Configuration

```bash
npx perflock init
```

This creates `perf.contracts.ts`:

```typescript
import { defineContracts } from '@samithahansaka/perflock';

export default defineContracts({
  global: {
    runs: 10,
    regressionThreshold: 0.15,
  },
  components: {
    UserCard: {
      maxRenderTime: 16, // ms
      maxRenderCount: 3,
      interactions: {
        click: { maxRenders: 2 },
        type: { maxRenders: 1 },
      },
    },
  },
});
```

### 2. Write Performance Tests

```typescript
// __perf__/UserCard.perf.tsx
import { measureInteraction, interactions } from '@samithahansaka/perflock';
import { render, fireEvent } from '@testing-library/react';
import { UserCard } from '../src/components/UserCard';

test('UserCard meets performance contract', async () => {
  const result = await measureInteraction(
    <UserCard user={mockUser} />,
    {
      interactions: [
        interactions.click('[data-testid="edit-btn"]'),
        interactions.type('[data-testid="email-input"]', 'test@example.com'),
      ],
      contract: 'UserCard',
    },
    { render, fireEvent }
  );

  expect(result).toPassContract();
});
```

### 3. Run Tests

```bash
npx perflock run
```

## API Reference

### `defineContracts(config)`

Define performance contracts for your components.

```typescript
defineContracts({
  global: {
    runs: 10, // Test runs for stability
    warmupRuns: 1, // Warmup runs to discard
    historyWindow: 20, // Compare against last N runs
    regressionThreshold: 0.15, // 15% regression threshold
  },
  components: {
    ComponentName: {
      maxRenderTime: 16, // Max average render time (ms)
      maxRenderCount: 3, // Max renders per scenario
      warningThreshold: 0.8, // Warn at 80% of budget
      interactions: {
        click: { maxRenders: 2 },
        type: { maxRenders: 1 },
      },
    },
  },
});
```

### `measureInteraction(element, options, dependencies)`

Measure component renders during user interactions.

```typescript
const result = await measureInteraction(
  <MyComponent />,
  {
    interactions: [
      { type: 'click', target: '[data-testid="btn"]' },
      { type: 'type', target: 'input', text: 'hello' },
    ],
    contract: 'MyComponent',
    runs: 10,
  },
  { render, fireEvent }
);

// result.metrics.renderCount
// result.metrics.averageRenderTime
// result.rendersByType.click
// result.rendersByType.type
```

### Jest/Vitest Matchers

```typescript
import { extendExpect } from '@samithahansaka/perflock/jest';

extendExpect(expect);

// Now available:
expect(result).toPassContract('ComponentName');
expect(result).toHaveRendersAtMost(5);
expect(result).toHaveRenderTimeAtMost(16);
expect(result).toHaveRendersPerInteractionAtMost('click', 2);
expect(value).toBeWithinBudget(100);
```

## CLI Commands

```bash
# Initialize configuration
npx perflock init

# Run performance tests
npx perflock run

# Generate report
npx perflock report --format markdown

# Compare with baseline
npx perflock compare --baseline ./baseline.json
```

## GitHub Action

```yaml
name: Performance Contracts

on:
  pull_request:
    branches: [main]

jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci

      - uses: samithahansaka/perflock-action@v1
        with:
          test-command: 'npm run test:perf'
          fail-on-budget-exceeded: true
          comment-on-pr: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Packages

| Package                           | Description   |
| --------------------------------- | ------------- |
| `@samithahansaka/perflock`        | Core library  |
| `@samithahansaka/perflock-cli`    | CLI tool      |
| `@samithahansaka/perflock-action` | GitHub Action |

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Author

**Samitha Hansaka** - [@samithahansaka](https://github.com/samithahansaka)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
