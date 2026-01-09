/**
 * Jest integration for @samithahansaka/perflock
 * Provides custom matchers for performance contract validation
 */

import type { RenderMetrics, InteractionType } from './contracts/types';
import type { MeasureInteractionResult } from './measurement/interaction';
import {
  validateAgainstContract,
  getConfig,
  getComponentContract,
  formatValidationSummary,
  isWithinBudget,
  getBudgetUtilization,
} from './index';

/**
 * Matcher result type compatible with Jest/Vitest
 */
interface MatcherResult {
  pass: boolean;
  message: () => string;
}

/**
 * Extended matchers for Jest/Vitest
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /**
       * Assert that measurements pass a named contract
       * @param contractName - Name of the contract to validate against
       */
      toPassContract(contractName?: string): Promise<R>;

      /**
       * Assert that a metric is within a specified budget
       * @param budget - Maximum allowed value
       */
      toBeWithinBudget(budget: number): R;

      /**
       * Assert that render count is at most the specified value
       * @param maxRenders - Maximum allowed renders
       */
      toHaveRendersAtMost(maxRenders: number): R;

      /**
       * Assert that render time is at most the specified value in ms
       * @param maxMs - Maximum allowed render time in milliseconds
       */
      toHaveRenderTimeAtMost(maxMs: number): R;

      /**
       * Assert that renders per interaction type is at most the specified value
       * @param interactionType - Type of interaction
       * @param maxRenders - Maximum allowed renders
       */
      toHaveRendersPerInteractionAtMost(
        interactionType: InteractionType,
        maxRenders: number
      ): R;
    }
  }
}

// Type guard for MeasureInteractionResult
function isMeasureInteractionResult(
  value: unknown
): value is MeasureInteractionResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'interactionResults' in value &&
    'metrics' in value
  );
}

// Type guard for RenderMetrics
function isRenderMetrics(value: unknown): value is RenderMetrics {
  return (
    typeof value === 'object' &&
    value !== null &&
    'renderCount' in value &&
    'totalActualDuration' in value &&
    !('interactionResults' in value)
  );
}

/**
 * Custom matcher: toPassContract
 */
async function toPassContract(
  received: MeasureInteractionResult | RenderMetrics,
  contractName?: string
): Promise<MatcherResult> {
  const config = await getConfig();

  // Determine component name
  const componentName =
    contractName ||
    ('componentName' in received ? received.componentName : 'unknown');

  const contract = getComponentContract(config, componentName);

  if (!contract) {
    return {
      pass: false,
      message: () =>
        `No contract found for component "${componentName}". ` +
        `Define one in your perf.contracts.ts file.`,
    };
  }

  const result = validateAgainstContract(componentName, received, contract);

  const pass = result.status !== 'fail';

  return {
    pass,
    message: () => {
      if (pass) {
        return (
          `Expected measurements NOT to pass contract "${componentName}", ` +
          `but they did:\n${formatValidationSummary(result)}`
        );
      }
      return (
        `Expected measurements to pass contract "${componentName}", ` +
        `but validation failed:\n${formatValidationSummary(result)}`
      );
    },
  };
}

/**
 * Custom matcher: toBeWithinBudget
 */
function toBeWithinBudget(received: number, budget: number): MatcherResult {
  const pass = isWithinBudget(received, budget);
  const utilization = getBudgetUtilization(received, budget);

  return {
    pass,
    message: () => {
      if (pass) {
        return (
          `Expected ${received} NOT to be within budget ${budget}, ` +
          `but it was (${(utilization * 100).toFixed(1)}% utilization)`
        );
      }
      return (
        `Expected ${received} to be within budget ${budget}, ` +
        `but it exceeded by ${((utilization - 1) * 100).toFixed(1)}%`
      );
    },
  };
}

/**
 * Custom matcher: toHaveRendersAtMost
 */
function toHaveRendersAtMost(
  received: MeasureInteractionResult | RenderMetrics | number,
  maxRenders: number
): MatcherResult {
  let actualRenders: number;

  if (typeof received === 'number') {
    actualRenders = received;
  } else if (isMeasureInteractionResult(received)) {
    actualRenders = received.metrics.renderCount;
  } else if (isRenderMetrics(received)) {
    actualRenders = received.renderCount;
  } else {
    return {
      pass: false,
      message: () =>
        `Expected a number, RenderMetrics, or MeasureInteractionResult, ` +
        `but received ${typeof received}`,
    };
  }

  const pass = actualRenders <= maxRenders;

  return {
    pass,
    message: () => {
      if (pass) {
        return (
          `Expected renders (${actualRenders}) NOT to be at most ${maxRenders}, ` +
          `but it was`
        );
      }
      return (
        `Expected renders to be at most ${maxRenders}, ` +
        `but got ${actualRenders} (${actualRenders - maxRenders} over budget)`
      );
    },
  };
}

/**
 * Custom matcher: toHaveRenderTimeAtMost
 */
function toHaveRenderTimeAtMost(
  received: MeasureInteractionResult | RenderMetrics | number,
  maxMs: number
): MatcherResult {
  let actualMs: number;

  if (typeof received === 'number') {
    actualMs = received;
  } else if (isMeasureInteractionResult(received)) {
    actualMs = received.metrics.averageRenderTime;
  } else if (isRenderMetrics(received)) {
    actualMs = received.averageRenderTime;
  } else {
    return {
      pass: false,
      message: () =>
        `Expected a number, RenderMetrics, or MeasureInteractionResult, ` +
        `but received ${typeof received}`,
    };
  }

  const pass = actualMs <= maxMs;

  return {
    pass,
    message: () => {
      if (pass) {
        return (
          `Expected render time (${actualMs.toFixed(2)}ms) NOT to be at most ${maxMs}ms, ` +
          `but it was`
        );
      }
      return (
        `Expected render time to be at most ${maxMs}ms, ` +
        `but got ${actualMs.toFixed(2)}ms (${(actualMs - maxMs).toFixed(2)}ms over budget)`
      );
    },
  };
}

/**
 * Custom matcher: toHaveRendersPerInteractionAtMost
 */
function toHaveRendersPerInteractionAtMost(
  received: MeasureInteractionResult,
  interactionType: InteractionType,
  maxRenders: number
): MatcherResult {
  if (!isMeasureInteractionResult(received)) {
    return {
      pass: false,
      message: () =>
        `Expected a MeasureInteractionResult, but received ${typeof received}`,
    };
  }

  const actualRenders = received.rendersByType[interactionType] || 0;
  const pass = actualRenders <= maxRenders;

  return {
    pass,
    message: () => {
      if (pass) {
        return (
          `Expected renders per ${interactionType} (${actualRenders}) ` +
          `NOT to be at most ${maxRenders}, but it was`
        );
      }
      return (
        `Expected renders per ${interactionType} to be at most ${maxRenders}, ` +
        `but got ${actualRenders} (${actualRenders - maxRenders} over budget)`
      );
    },
  };
}

/**
 * All custom matchers
 */
export const matchers = {
  toPassContract,
  toBeWithinBudget,
  toHaveRendersAtMost,
  toHaveRenderTimeAtMost,
  toHaveRendersPerInteractionAtMost,
};

/**
 * Extend Jest/Vitest expect with custom matchers
 *
 * @example
 * ```typescript
 * import { expect } from 'vitest';
 * import { extendExpect } from '@samithahansaka/perflock/jest';
 *
 * extendExpect(expect);
 *
 * // Now you can use:
 * expect(result).toPassContract('UserCard');
 * expect(result).toHaveRendersAtMost(5);
 * ```
 */
export function extendExpect(expect: {
  extend: (matchers: object) => void;
}): void {
  expect.extend(matchers);
}

/**
 * Setup function for Jest configuration
 *
 * @example
 * ```typescript
 * // jest.setup.ts
 * import { setupJest } from '@samithahansaka/perflock/jest';
 * setupJest();
 * ```
 */
export function setupJest(): void {
  const globalExpect = (
    globalThis as { expect?: { extend?: (matchers: object) => void } }
  ).expect;
  if (globalExpect && typeof globalExpect.extend === 'function') {
    globalExpect.extend(matchers);
  }
}

// Re-export types and utilities that are useful for testing
export type { MeasureInteractionResult } from './measurement/interaction';
export type { RenderMetrics, ValidationResult } from './contracts/types';
export {
  measureInteraction,
  createInteractionMeasurer,
  interactions,
} from './measurement/interaction';
export { createProfiler, ProfilerWrapper } from './measurement/profiler';
export { defineContracts, getConfig } from './index';
