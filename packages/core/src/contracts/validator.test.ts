import { describe, it, expect } from 'vitest';
import {
  validateAgainstContract,
  passesContract,
  isWithinBudget,
  getBudgetUtilization,
  formatValidationSummary,
  getOverallStatus,
  countByStatus,
  addSuggestions,
} from './validator';
import type {
  ComponentContract,
  RenderMetrics,
  ValidationResult,
} from './types';

// Helper to create a full contract with defaults
function createContract(
  overrides: Partial<ComponentContract> = {}
): Required<ComponentContract> {
  return {
    maxRenderTime: 16,
    maxRenderCount: 5,
    maxMemoryDelta: Infinity,
    warningThreshold: 0.8,
    interactions: {},
    meta: {},
    ...overrides,
  } as Required<ComponentContract>;
}

// Helper to create render metrics
function createMetrics(overrides: Partial<RenderMetrics> = {}): RenderMetrics {
  return {
    componentName: 'TestComponent',
    renderCount: 3,
    totalActualDuration: 30,
    totalBaseDuration: 25,
    averageRenderTime: 10,
    renders: [],
    ...overrides,
  };
}

describe('isWithinBudget', () => {
  it('returns true when actual is less than budget', () => {
    expect(isWithinBudget(5, 10)).toBe(true);
  });

  it('returns true when actual equals budget', () => {
    expect(isWithinBudget(10, 10)).toBe(true);
  });

  it('returns false when actual exceeds budget', () => {
    expect(isWithinBudget(15, 10)).toBe(false);
  });
});

describe('getBudgetUtilization', () => {
  it('calculates correct utilization percentage', () => {
    expect(getBudgetUtilization(5, 10)).toBe(0.5);
    expect(getBudgetUtilization(10, 10)).toBe(1);
    expect(getBudgetUtilization(15, 10)).toBe(1.5);
  });

  it('returns 0 when budget is 0', () => {
    expect(getBudgetUtilization(5, 0)).toBe(0);
  });
});

describe('validateAgainstContract', () => {
  it('returns pass status when all metrics are within budget', () => {
    const metrics = createMetrics({
      averageRenderTime: 10,
      renderCount: 3,
    });
    const contract = createContract({
      maxRenderTime: 16,
      maxRenderCount: 5,
    });

    const result = validateAgainstContract('TestComponent', metrics, contract);

    expect(result.status).toBe('pass');
    expect(result.violations).toHaveLength(0);
  });

  it('returns warn status when metrics exceed warning threshold', () => {
    const metrics = createMetrics({
      averageRenderTime: 14, // 87.5% of 16ms budget
      renderCount: 3,
    });
    const contract = createContract({
      maxRenderTime: 16,
      maxRenderCount: 5,
      warningThreshold: 0.8,
    });

    const result = validateAgainstContract('TestComponent', metrics, contract);

    expect(result.status).toBe('warn');
    expect(result.violations).toHaveLength(0);
  });

  it('returns fail status when metrics exceed budget', () => {
    const metrics = createMetrics({
      averageRenderTime: 20, // exceeds 16ms budget
      renderCount: 3,
    });
    const contract = createContract({
      maxRenderTime: 16,
      maxRenderCount: 5,
    });

    const result = validateAgainstContract('TestComponent', metrics, contract);

    expect(result.status).toBe('fail');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].metric).toBe('renderTime');
  });

  it('returns fail when render count exceeds budget', () => {
    const metrics = createMetrics({
      averageRenderTime: 10,
      renderCount: 8, // exceeds 5 render budget
    });
    const contract = createContract({
      maxRenderTime: 16,
      maxRenderCount: 5,
    });

    const result = validateAgainstContract('TestComponent', metrics, contract);

    expect(result.status).toBe('fail');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].metric).toBe('renderCount');
  });

  it('accumulates multiple violations', () => {
    const metrics = createMetrics({
      averageRenderTime: 20, // exceeds budget
      renderCount: 8, // exceeds budget
    });
    const contract = createContract({
      maxRenderTime: 16,
      maxRenderCount: 5,
    });

    const result = validateAgainstContract('TestComponent', metrics, contract);

    expect(result.status).toBe('fail');
    expect(result.violations).toHaveLength(2);
  });

  it('validates interaction budgets', () => {
    const interactionResult = {
      componentName: 'TestComponent',
      metrics: createMetrics(),
      interactionResults: [],
      totalRenders: 5,
      rendersPerInteraction: 2.5,
      rendersByType: {
        click: 4, // exceeds budget of 2
        type: 1,
      },
      timestamp: Date.now(),
    };

    const contract = createContract({
      interactions: {
        click: { maxRenders: 2 },
        type: { maxRenders: 3 },
      },
    });

    const result = validateAgainstContract(
      'TestComponent',
      interactionResult,
      contract
    );

    expect(result.status).toBe('fail');
    expect(
      result.violations.some((v) => v.metric === 'rendersPerInteraction.click')
    ).toBe(true);
  });

  it('skips validation when budget is Infinity', () => {
    const metrics = createMetrics({
      averageRenderTime: 1000,
      renderCount: 1000,
    });
    const contract = createContract({
      maxRenderTime: Infinity,
      maxRenderCount: Infinity,
    });

    const result = validateAgainstContract('TestComponent', metrics, contract);

    expect(result.status).toBe('pass');
    expect(result.metrics.renderTime).toBeUndefined();
    expect(result.metrics.renderCount).toBeUndefined();
  });

  it('calculates correct violation severity', () => {
    const metrics = createMetrics({
      averageRenderTime: 32, // 100% over budget (severe)
      renderCount: 3,
    });
    const contract = createContract({
      maxRenderTime: 16,
      maxRenderCount: 5,
    });

    const result = validateAgainstContract('TestComponent', metrics, contract);

    expect(result.violations[0].severity).toBe('severe');
  });
});

describe('passesContract', () => {
  it('returns true when contract passes', () => {
    const metrics = createMetrics({
      averageRenderTime: 10,
      renderCount: 3,
    });
    const contract = createContract();

    expect(passesContract(metrics, contract)).toBe(true);
  });

  it('returns false when contract fails', () => {
    const metrics = createMetrics({
      averageRenderTime: 20,
      renderCount: 3,
    });
    const contract = createContract({ maxRenderTime: 16 });

    expect(passesContract(metrics, contract)).toBe(false);
  });

  it('returns true when contract warns (warn is not fail)', () => {
    const metrics = createMetrics({
      averageRenderTime: 14, // 87.5% - warning level
      renderCount: 3,
    });
    const contract = createContract({
      maxRenderTime: 16,
      warningThreshold: 0.8,
    });

    expect(passesContract(metrics, contract)).toBe(true);
  });
});

describe('getOverallStatus', () => {
  it('returns pass when all results pass', () => {
    const results: ValidationResult[] = [
      {
        status: 'pass',
        componentName: 'A',
        metrics: {},
        violations: [],
        suggestions: [],
      },
      {
        status: 'pass',
        componentName: 'B',
        metrics: {},
        violations: [],
        suggestions: [],
      },
    ];

    expect(getOverallStatus(results)).toBe('pass');
  });

  it('returns warn when any result warns', () => {
    const results: ValidationResult[] = [
      {
        status: 'pass',
        componentName: 'A',
        metrics: {},
        violations: [],
        suggestions: [],
      },
      {
        status: 'warn',
        componentName: 'B',
        metrics: {},
        violations: [],
        suggestions: [],
      },
    ];

    expect(getOverallStatus(results)).toBe('warn');
  });

  it('returns fail when any result fails', () => {
    const results: ValidationResult[] = [
      {
        status: 'pass',
        componentName: 'A',
        metrics: {},
        violations: [],
        suggestions: [],
      },
      {
        status: 'warn',
        componentName: 'B',
        metrics: {},
        violations: [],
        suggestions: [],
      },
      {
        status: 'fail',
        componentName: 'C',
        metrics: {},
        violations: [],
        suggestions: [],
      },
    ];

    expect(getOverallStatus(results)).toBe('fail');
  });
});

describe('countByStatus', () => {
  it('counts results by status correctly', () => {
    const results: ValidationResult[] = [
      {
        status: 'pass',
        componentName: 'A',
        metrics: {},
        violations: [],
        suggestions: [],
      },
      {
        status: 'pass',
        componentName: 'B',
        metrics: {},
        violations: [],
        suggestions: [],
      },
      {
        status: 'warn',
        componentName: 'C',
        metrics: {},
        violations: [],
        suggestions: [],
      },
      {
        status: 'fail',
        componentName: 'D',
        metrics: {},
        violations: [],
        suggestions: [],
      },
    ];

    const counts = countByStatus(results);

    expect(counts.pass).toBe(2);
    expect(counts.warn).toBe(1);
    expect(counts.fail).toBe(1);
  });

  it('returns zeros for empty array', () => {
    const counts = countByStatus([]);

    expect(counts.pass).toBe(0);
    expect(counts.warn).toBe(0);
    expect(counts.fail).toBe(0);
  });
});

describe('formatValidationSummary', () => {
  it('formats passing result correctly', () => {
    const result: ValidationResult = {
      status: 'pass',
      componentName: 'TestComponent',
      metrics: {
        renderTime: {
          actual: 10,
          budget: 16,
          utilization: 0.625,
          status: 'pass',
        },
      },
      violations: [],
      suggestions: [],
    };

    const summary = formatValidationSummary(result);

    expect(summary).toContain('✓ TestComponent: PASS');
    expect(summary).toContain('Render Time: 10.00ms / 16ms (63%)');
  });

  it('formats failing result with violations', () => {
    const result: ValidationResult = {
      status: 'fail',
      componentName: 'TestComponent',
      metrics: {
        renderTime: {
          actual: 20,
          budget: 16,
          utilization: 1.25,
          status: 'fail',
          exceededBy: 0.25,
        },
      },
      violations: [
        {
          metric: 'renderTime',
          budget: 16,
          actual: 20,
          exceededByPercent: 0.25,
          severity: 'minor',
        },
      ],
      suggestions: [],
    };

    const summary = formatValidationSummary(result);

    expect(summary).toContain('✗ TestComponent: FAIL');
    expect(summary).toContain('Violations:');
    expect(summary).toContain('renderTime: exceeded by 25%');
  });
});

describe('addSuggestions', () => {
  it('adds suggestions to result', () => {
    const result: ValidationResult = {
      status: 'fail',
      componentName: 'TestComponent',
      metrics: {},
      violations: [],
      suggestions: [],
    };

    const suggestions = [
      {
        severity: 'high' as const,
        line: 10,
        pattern: 'missing-memo',
        description: 'Component re-renders on every parent update',
        fix: 'Consider using React.memo',
      },
    ];

    const updated = addSuggestions(result, suggestions);

    expect(updated.suggestions).toHaveLength(1);
    expect(updated.suggestions[0].pattern).toBe('missing-memo');
  });

  it('preserves existing suggestions', () => {
    const result: ValidationResult = {
      status: 'fail',
      componentName: 'TestComponent',
      metrics: {},
      violations: [],
      suggestions: [
        {
          severity: 'medium' as const,
          line: 20,
          pattern: 'missing-callback',
          description: 'Function recreated on every render',
          fix: 'Use useCallback',
        },
      ],
    };

    const newSuggestions = [
      {
        severity: 'high' as const,
        line: 10,
        pattern: 'missing-memo',
        description: 'Component re-renders on every parent update',
        fix: 'Consider using React.memo',
      },
    ];

    const updated = addSuggestions(result, newSuggestions);

    expect(updated.suggestions).toHaveLength(2);
  });
});
