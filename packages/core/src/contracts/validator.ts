/**
 * Contract validation engine
 * Compares measurements against defined performance budgets
 */

import type {
  ComponentContract,
  ValidationResult,
  ValidationStatus,
  MetricValidation,
  Violation,
  FixSuggestion,
  InteractionType,
  RenderMetrics,
} from './types';
import type { MeasureInteractionResult } from '../measurement/interaction';
import { getConfig, getComponentContract, ResolvedConfig } from './loader';

/**
 * Determine validation status from utilization percentage
 */
function getStatusFromUtilization(
  utilization: number,
  warningThreshold: number
): ValidationStatus {
  if (utilization > 1) {
    return 'fail';
  }
  if (utilization > warningThreshold) {
    return 'warn';
  }
  return 'pass';
}

/**
 * Calculate metric validation result
 */
function validateMetric(
  actual: number,
  budget: number,
  warningThreshold: number
): MetricValidation {
  const utilization = actual / budget;
  const status = getStatusFromUtilization(utilization, warningThreshold);
  const exceededBy = utilization > 1 ? (actual - budget) / budget : undefined;

  return {
    actual,
    budget,
    utilization,
    status,
    exceededBy,
  };
}

/**
 * Get violation severity based on how much budget was exceeded
 */
function getViolationSeverity(
  exceededByPercent: number
): 'minor' | 'moderate' | 'severe' {
  if (exceededByPercent < 0.25) {
    return 'minor';
  }
  if (exceededByPercent < 0.5) {
    return 'moderate';
  }
  return 'severe';
}

/**
 * Create a violation object
 */
function createViolation(
  metric: string,
  budget: number,
  actual: number
): Violation {
  const exceededByPercent = (actual - budget) / budget;
  return {
    metric,
    budget,
    actual,
    exceededByPercent,
    severity: getViolationSeverity(exceededByPercent),
  };
}

/**
 * Combine multiple statuses into overall status
 */
function combineStatuses(statuses: ValidationStatus[]): ValidationStatus {
  if (statuses.includes('fail')) {
    return 'fail';
  }
  if (statuses.includes('warn')) {
    return 'warn';
  }
  return 'pass';
}

/**
 * Validate measurements against a component contract
 *
 * @param componentName - Name of the component
 * @param measurements - Measurement results (either metrics or interaction result)
 * @param contract - Component contract to validate against
 * @returns Validation result
 */
export function validateAgainstContract(
  componentName: string,
  measurements: RenderMetrics | MeasureInteractionResult,
  contract: Required<ComponentContract>
): ValidationResult {
  const statuses: ValidationStatus[] = [];
  const violations: Violation[] = [];
  const metrics: ValidationResult['metrics'] = {};

  const warningThreshold = contract.warningThreshold;

  // Extract metrics from either type
  const renderMetrics: RenderMetrics =
    'metrics' in measurements ? measurements.metrics : measurements;

  // Validate render time
  if (contract.maxRenderTime !== Infinity) {
    const avgRenderTime = renderMetrics.averageRenderTime;
    const validation = validateMetric(
      avgRenderTime,
      contract.maxRenderTime,
      warningThreshold
    );
    metrics.renderTime = validation;
    statuses.push(validation.status);

    if (validation.status === 'fail') {
      violations.push(
        createViolation('renderTime', contract.maxRenderTime, avgRenderTime)
      );
    }
  }

  // Validate render count
  if (contract.maxRenderCount !== Infinity) {
    const renderCount = renderMetrics.renderCount;
    const validation = validateMetric(
      renderCount,
      contract.maxRenderCount,
      warningThreshold
    );
    metrics.renderCount = validation;
    statuses.push(validation.status);

    if (validation.status === 'fail') {
      violations.push(
        createViolation('renderCount', contract.maxRenderCount, renderCount)
      );
    }
  }

  // Validate per-interaction budgets (if interaction result)
  if ('interactionResults' in measurements && contract.interactions) {
    const interactionValidations: Partial<
      Record<InteractionType, MetricValidation>
    > = {};

    // Group renders by interaction type
    const rendersByType = measurements.rendersByType;

    for (const [interactionType, budget] of Object.entries(contract.interactions)) {
      const type = interactionType as InteractionType;
      const actualRenders = rendersByType[type] || 0;

      if (budget.maxRenders !== undefined) {
        const validation = validateMetric(
          actualRenders,
          budget.maxRenders,
          warningThreshold
        );
        interactionValidations[type] = validation;
        statuses.push(validation.status);

        if (validation.status === 'fail') {
          violations.push(
            createViolation(
              `rendersPerInteraction.${type}`,
              budget.maxRenders,
              actualRenders
            )
          );
        }
      }
    }

    if (Object.keys(interactionValidations).length > 0) {
      metrics.rendersPerInteraction = interactionValidations;
    }
  }

  // TODO: Memory delta validation would go here

  const status = statuses.length > 0 ? combineStatuses(statuses) : 'pass';

  return {
    status,
    componentName,
    metrics,
    violations,
    suggestions: [], // Suggestions will be added by diagnostics module
  };
}

/**
 * Validate measurements against configured contracts
 *
 * @param componentName - Name of the component
 * @param measurements - Measurement results
 * @param config - Optional resolved config (will load if not provided)
 * @returns Validation result or null if no contract found
 */
export async function validateContract(
  componentName: string,
  measurements: RenderMetrics | MeasureInteractionResult,
  config?: ResolvedConfig
): Promise<ValidationResult | null> {
  const resolvedConfig = config || (await getConfig());
  const contract = getComponentContract(resolvedConfig, componentName);

  if (!contract) {
    return null;
  }

  return validateAgainstContract(componentName, measurements, contract);
}

/**
 * Validate measurements synchronously (requires config to be pre-loaded)
 */
export function validateContractSync(
  componentName: string,
  measurements: RenderMetrics | MeasureInteractionResult,
  config: ResolvedConfig
): ValidationResult | null {
  const contract = getComponentContract(config, componentName);

  if (!contract) {
    return null;
  }

  return validateAgainstContract(componentName, measurements, contract);
}

/**
 * Quick check if measurements pass contract (no detailed report)
 */
export function passesContract(
  measurements: RenderMetrics | MeasureInteractionResult,
  contract: Required<ComponentContract>
): boolean {
  const componentName = measurements.componentName;
  const result = validateAgainstContract(componentName, measurements, contract);
  return result.status !== 'fail';
}

/**
 * Check if a single metric is within budget
 */
export function isWithinBudget(actual: number, budget: number): boolean {
  return actual <= budget;
}

/**
 * Calculate budget utilization percentage
 */
export function getBudgetUtilization(actual: number, budget: number): number {
  return budget > 0 ? actual / budget : 0;
}

/**
 * Format validation result as a summary string
 */
export function formatValidationSummary(result: ValidationResult): string {
  const statusEmoji = {
    pass: '✓',
    warn: '⚠',
    fail: '✗',
  };

  const lines: string[] = [
    `${statusEmoji[result.status]} ${result.componentName}: ${result.status.toUpperCase()}`,
  ];

  if (result.metrics.renderTime) {
    const rt = result.metrics.renderTime;
    lines.push(
      `  Render Time: ${rt.actual.toFixed(2)}ms / ${rt.budget}ms (${(rt.utilization * 100).toFixed(0)}%)`
    );
  }

  if (result.metrics.renderCount) {
    const rc = result.metrics.renderCount;
    lines.push(
      `  Render Count: ${rc.actual} / ${rc.budget} (${(rc.utilization * 100).toFixed(0)}%)`
    );
  }

  if (result.metrics.rendersPerInteraction) {
    for (const [type, validation] of Object.entries(
      result.metrics.rendersPerInteraction
    )) {
      if (validation) {
        lines.push(
          `  Renders/${type}: ${validation.actual} / ${validation.budget} (${(validation.utilization * 100).toFixed(0)}%)`
        );
      }
    }
  }

  if (result.violations.length > 0) {
    lines.push('  Violations:');
    for (const v of result.violations) {
      lines.push(
        `    - ${v.metric}: exceeded by ${(v.exceededByPercent * 100).toFixed(0)}% (${v.severity})`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Batch validate multiple components
 */
export async function validateMultiple(
  results: Array<{
    componentName: string;
    measurements: RenderMetrics | MeasureInteractionResult;
  }>,
  config?: ResolvedConfig
): Promise<ValidationResult[]> {
  const resolvedConfig = config || (await getConfig());
  const validations: ValidationResult[] = [];

  for (const { componentName, measurements } of results) {
    const validation = validateContractSync(
      componentName,
      measurements,
      resolvedConfig
    );
    if (validation) {
      validations.push(validation);
    }
  }

  return validations;
}

/**
 * Get overall status from multiple validation results
 */
export function getOverallStatus(results: ValidationResult[]): ValidationStatus {
  return combineStatuses(results.map((r) => r.status));
}

/**
 * Count results by status
 */
export function countByStatus(results: ValidationResult[]): {
  pass: number;
  warn: number;
  fail: number;
} {
  return {
    pass: results.filter((r) => r.status === 'pass').length,
    warn: results.filter((r) => r.status === 'warn').length,
    fail: results.filter((r) => r.status === 'fail').length,
  };
}

/**
 * Add suggestions to validation result
 */
export function addSuggestions(
  result: ValidationResult,
  suggestions: FixSuggestion[]
): ValidationResult {
  return {
    ...result,
    suggestions: [...result.suggestions, ...suggestions],
  };
}
