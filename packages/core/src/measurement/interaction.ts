/**
 * Interaction measurement module
 * Measures component renders per user interaction (click, type, etc.)
 */

import React, { ReactElement } from 'react';
import type {
  InteractionSpec,
  InteractionResult,
  InteractionType,
  MeasureInteractionOptions,
  RenderMetrics,
  RenderEvent,
} from '../contracts/types';
import { createProfiler, ProfilerInstance } from './profiler';

/**
 * Result of measureInteraction function
 */
export interface MeasureInteractionResult {
  /** Component name */
  componentName: string;
  /** Render metrics */
  metrics: RenderMetrics;
  /** Per-interaction results */
  interactionResults: InteractionResult[];
  /** Total renders across all interactions */
  totalRenders: number;
  /** Average renders per interaction */
  rendersPerInteraction: number;
  /** Renders grouped by interaction type */
  rendersByType: Partial<Record<InteractionType, number>>;
  /** Timestamp of measurement */
  timestamp: number;
  /** Contract validation (if contract specified) */
  contractValidation?: {
    passed: boolean;
    contract: string;
  };
}

/**
 * Testing library render result type
 */
interface RenderResult {
  container: HTMLElement;
  getByTestId: (testId: string) => HTMLElement;
  getByText: (text: string) => HTMLElement;
  getByRole: (role: string, options?: Record<string, unknown>) => HTMLElement;
  queryByTestId: (testId: string) => HTMLElement | null;
  rerender: (ui: ReactElement) => void;
  unmount: () => void;
}

/**
 * Render function type (from @testing-library/react)
 */
type RenderFunction = (ui: ReactElement) => RenderResult;

/**
 * Fire event function type
 */
interface FireEventFunction {
  click: (element: Element) => void;
  change: (element: Element, options: { target: { value: string } }) => void;
  focus: (element: Element) => void;
  blur: (element: Element) => void;
  scroll: (element: Element) => void;
  mouseEnter: (element: Element) => void;
  mouseLeave: (element: Element) => void;
}

/**
 * Internal state for tracking renders during interactions
 */
interface InteractionTracker {
  profiler: ProfilerInstance;
  rendersBefore: number;
  rendersAfter: number;
  renderTimeBefore: number;
  renderTimeAfter: number;
}

/**
 * Create a wrapped element with profiler
 */
function wrapWithProfiler(
  element: ReactElement,
  profiler: ProfilerInstance,
  componentName: string
): ReactElement {
  return React.createElement(
    React.Profiler,
    {
      id: componentName,
      onRender: profiler.onRenderCallback,
    },
    element
  );
}

/**
 * Find element by selector
 */
function findElement(
  container: HTMLElement,
  selector: string,
  renderResult: RenderResult
): Element {
  // Try data-testid first
  if (selector.startsWith('[data-testid=')) {
    const testId = selector.match(/\[data-testid="?([^"\]]+)"?\]/)?.[1];
    if (testId) {
      const el = renderResult.queryByTestId(testId);
      if (el) return el;
    }
  }

  // Try CSS selector
  const element = container.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

/**
 * Perform an interaction and track renders
 */
async function performInteraction(
  interaction: InteractionSpec,
  container: HTMLElement,
  renderResult: RenderResult,
  fireEvent: FireEventFunction,
  tracker: InteractionTracker
): Promise<InteractionResult> {
  const element = findElement(container, interaction.target, renderResult);

  // Record state before interaction
  tracker.rendersBefore = tracker.profiler.metrics.renderCount;
  tracker.renderTimeBefore = tracker.profiler.metrics.totalActualDuration;

  // Perform the interaction
  switch (interaction.type) {
    case 'click':
      fireEvent.click(element);
      break;
    case 'type':
      if (interaction.text) {
        // Simulate typing character by character for realistic render tracking
        for (const char of interaction.text) {
          const currentValue =
            (element as HTMLInputElement).value || '';
          fireEvent.change(element, {
            target: { value: currentValue + char },
          });
          // Small delay to allow React to batch updates
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      break;
    case 'focus':
      fireEvent.focus(element);
      break;
    case 'blur':
      fireEvent.blur(element);
      break;
    case 'scroll':
      fireEvent.scroll(element);
      break;
    case 'hover':
      fireEvent.mouseEnter(element);
      break;
    default:
      throw new Error(`Unknown interaction type: ${interaction.type}`);
  }

  // Wait for React to finish rendering
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Record state after interaction
  tracker.rendersAfter = tracker.profiler.metrics.renderCount;
  tracker.renderTimeAfter = tracker.profiler.metrics.totalActualDuration;

  const rendersTriggered = tracker.rendersAfter - tracker.rendersBefore;
  const totalRenderTime = tracker.renderTimeAfter - tracker.renderTimeBefore;

  return {
    interaction,
    rendersTriggered,
    totalRenderTime,
    averageRenderTime: rendersTriggered > 0 ? totalRenderTime / rendersTriggered : 0,
  };
}

/**
 * Measure component renders during user interactions
 *
 * @param element - React element to measure
 * @param options - Measurement options including interactions to perform
 * @param dependencies - Testing library dependencies (render, fireEvent)
 * @returns Measurement result with per-interaction breakdown
 *
 * @example
 * ```typescript
 * const result = await measureInteraction(
 *   <UserCard user={mockUser} />,
 *   {
 *     interactions: [
 *       { type: 'click', target: '[data-testid="edit-btn"]' },
 *       { type: 'type', target: 'input[name="email"]', text: 'test@example.com' },
 *     ],
 *     contract: 'UserCard',
 *   },
 *   { render, fireEvent }
 * );
 * ```
 */
export async function measureInteraction(
  element: ReactElement,
  options: MeasureInteractionOptions,
  dependencies: {
    render: RenderFunction;
    fireEvent: FireEventFunction;
    act?: (callback: () => void | Promise<void>) => Promise<void>;
  }
): Promise<MeasureInteractionResult> {
  const { interactions, contract, runs = 1 } = options;
  const { render, fireEvent, act } = dependencies;

  const componentName =
    typeof element.type === 'string'
      ? element.type
      : (element.type as { displayName?: string; name?: string }).displayName ||
        (element.type as { name?: string }).name ||
        'UnknownComponent';

  const allResults: MeasureInteractionResult[] = [];

  for (let run = 0; run < runs; run++) {
    const profiler = createProfiler(componentName);
    const wrappedElement = wrapWithProfiler(element, profiler, componentName);

    // Render the component
    const renderResult = render(wrappedElement);
    const { container } = renderResult;

    // Wait for initial render to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Reset profiler to only track interaction renders (not initial mount)
    const mountRenders = profiler.metrics.renderCount;
    const mountRenderTime = profiler.metrics.totalActualDuration;

    const tracker: InteractionTracker = {
      profiler,
      rendersBefore: mountRenders,
      rendersAfter: mountRenders,
      renderTimeBefore: mountRenderTime,
      renderTimeAfter: mountRenderTime,
    };

    const interactionResults: InteractionResult[] = [];

    // Perform each interaction
    for (const interaction of interactions) {
      const actFn = act || (async (cb: () => void | Promise<void>) => { await cb(); });

      let result: InteractionResult;
      await actFn(async () => {
        result = await performInteraction(
          interaction,
          container,
          renderResult,
          fireEvent,
          tracker
        );
      });
      interactionResults.push(result!);
    }

    // Calculate aggregated metrics
    const totalRenders = interactionResults.reduce(
      (sum, r) => sum + r.rendersTriggered,
      0
    );

    const rendersByType: Partial<Record<InteractionType, number>> = {};
    for (const result of interactionResults) {
      const type = result.interaction.type;
      rendersByType[type] = (rendersByType[type] || 0) + result.rendersTriggered;
    }

    allResults.push({
      componentName,
      metrics: profiler.getSnapshot(),
      interactionResults,
      totalRenders,
      rendersPerInteraction:
        interactions.length > 0 ? totalRenders / interactions.length : 0,
      rendersByType,
      timestamp: Date.now(),
      contractValidation: contract
        ? { passed: true, contract } // Will be validated later
        : undefined,
    });

    // Cleanup
    renderResult.unmount();
  }

  // Return single run or aggregate multiple runs
  if (runs === 1) {
    return allResults[0];
  }

  // Aggregate multiple runs
  return aggregateResults(allResults);
}

/**
 * Aggregate results from multiple runs
 */
function aggregateResults(results: MeasureInteractionResult[]): MeasureInteractionResult {
  if (results.length === 0) {
    throw new Error('No results to aggregate');
  }

  const first = results[0];
  const allRenders: RenderEvent[] = [];
  let totalRenderCount = 0;
  let totalActualDuration = 0;
  let totalBaseDuration = 0;

  for (const result of results) {
    allRenders.push(...result.metrics.renders);
    totalRenderCount += result.metrics.renderCount;
    totalActualDuration += result.metrics.totalActualDuration;
    totalBaseDuration += result.metrics.totalBaseDuration;
  }

  const avgRenderCount = totalRenderCount / results.length;
  const avgActualDuration = totalActualDuration / results.length;

  // Aggregate interaction results
  const aggregatedInteractions: InteractionResult[] = first.interactionResults.map(
    (_, index) => {
      const interactionData = results.map((r) => r.interactionResults[index]);
      const avgRenders =
        interactionData.reduce((sum, r) => sum + r.rendersTriggered, 0) /
        results.length;
      const avgTime =
        interactionData.reduce((sum, r) => sum + r.totalRenderTime, 0) /
        results.length;

      return {
        interaction: first.interactionResults[index].interaction,
        rendersTriggered: Math.round(avgRenders),
        totalRenderTime: avgTime,
        averageRenderTime: avgRenders > 0 ? avgTime / avgRenders : 0,
      };
    }
  );

  const totalRenders = aggregatedInteractions.reduce(
    (sum, r) => sum + r.rendersTriggered,
    0
  );

  const rendersByType: Partial<Record<InteractionType, number>> = {};
  for (const result of aggregatedInteractions) {
    const type = result.interaction.type;
    rendersByType[type] = (rendersByType[type] || 0) + result.rendersTriggered;
  }

  return {
    componentName: first.componentName,
    metrics: {
      componentName: first.componentName,
      renderCount: Math.round(avgRenderCount),
      totalActualDuration: avgActualDuration,
      totalBaseDuration: totalBaseDuration / results.length,
      averageRenderTime: avgRenderCount > 0 ? avgActualDuration / avgRenderCount : 0,
      renders: allRenders,
    },
    interactionResults: aggregatedInteractions,
    totalRenders,
    rendersPerInteraction:
      first.interactionResults.length > 0
        ? totalRenders / first.interactionResults.length
        : 0,
    rendersByType,
    timestamp: Date.now(),
    contractValidation: first.contractValidation,
  };
}

/**
 * Create a measurement wrapper for easier testing
 */
export function createInteractionMeasurer(dependencies: {
  render: RenderFunction;
  fireEvent: FireEventFunction;
  act?: (callback: () => void | Promise<void>) => Promise<void>;
}) {
  return async function measure(
    element: ReactElement,
    options: MeasureInteractionOptions
  ): Promise<MeasureInteractionResult> {
    return measureInteraction(element, options, dependencies);
  };
}

/**
 * Helper to create interaction specs
 */
export const interactions = {
  click: (target: string): InteractionSpec => ({ type: 'click', target }),
  type: (target: string, text: string): InteractionSpec => ({
    type: 'type',
    target,
    text,
  }),
  focus: (target: string): InteractionSpec => ({ type: 'focus', target }),
  blur: (target: string): InteractionSpec => ({ type: 'blur', target }),
  scroll: (target: string): InteractionSpec => ({ type: 'scroll', target }),
  hover: (target: string): InteractionSpec => ({ type: 'hover', target }),
};
