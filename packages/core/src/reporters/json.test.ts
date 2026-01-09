import { describe, it, expect } from 'vitest';
import {
  generateJsonReport,
  parseJsonReport,
  isValidJsonReport,
  mergeJsonReports,
  getFailedResults,
  getWarningResults,
  createMinimalReport,
} from './json';
import type { ValidationResult, TestReport } from '../contracts/types';
import { VERSION } from '../index';

// Helper to create validation results
function createResult(
  componentName: string,
  status: 'pass' | 'warn' | 'fail',
  violations: number = 0
): ValidationResult {
  return {
    componentName,
    status,
    metrics: {},
    violations: Array(violations).fill({
      metric: 'renderTime',
      budget: 16,
      actual: 20,
      exceededByPercent: 0.25,
      severity: 'minor',
    }),
    suggestions: [],
  };
}

describe('generateJsonReport', () => {
  it('generates valid JSON string', () => {
    const results = [createResult('ComponentA', 'pass')];
    const json = generateJsonReport(results);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes version and timestamp', () => {
    const results = [createResult('ComponentA', 'pass')];
    const json = generateJsonReport(results);
    const report = JSON.parse(json);

    expect(report.version).toBe(VERSION);
    expect(typeof report.timestamp).toBe('number');
  });

  it('calculates correct summary', () => {
    const results = [
      createResult('ComponentA', 'pass'),
      createResult('ComponentB', 'warn'),
      createResult('ComponentC', 'fail'),
    ];
    const json = generateJsonReport(results);
    const report = JSON.parse(json);

    expect(report.summary.componentsTested).toBe(3);
    expect(report.summary.contractsPassed).toBe(1);
    expect(report.summary.contractsWarning).toBe(1);
    expect(report.summary.contractsFailed).toBe(1);
  });

  it('determines overall status correctly', () => {
    const passingResults = [
      createResult('ComponentA', 'pass'),
      createResult('ComponentB', 'pass'),
    ];
    expect(JSON.parse(generateJsonReport(passingResults)).status).toBe('pass');

    const warningResults = [
      createResult('ComponentA', 'pass'),
      createResult('ComponentB', 'warn'),
    ];
    expect(JSON.parse(generateJsonReport(warningResults)).status).toBe('warn');

    const failingResults = [
      createResult('ComponentA', 'pass'),
      createResult('ComponentB', 'fail'),
    ];
    expect(JSON.parse(generateJsonReport(failingResults)).status).toBe('fail');
  });

  it('respects prettyPrint option', () => {
    const results = [createResult('ComponentA', 'pass')];

    const pretty = generateJsonReport(results, { prettyPrint: true });
    const compact = generateJsonReport(results, { prettyPrint: false });

    expect(pretty.length).toBeGreaterThan(compact.length);
    expect(pretty).toContain('\n');
    expect(compact).not.toContain('\n');
  });

  it('respects indentSize option', () => {
    const results = [createResult('ComponentA', 'pass')];

    const indent2 = generateJsonReport(results, { indentSize: 2 });
    const indent4 = generateJsonReport(results, { indentSize: 4 });

    expect(indent4.length).toBeGreaterThan(indent2.length);
  });

  it('excludes suggestions when includeSuggestions is false', () => {
    const results = [
      {
        ...createResult('ComponentA', 'fail'),
        suggestions: [
          {
            severity: 'high' as const,
            line: 10,
            pattern: 'missing-memo',
            description: 'Component re-renders on every parent update',
            fix: 'Use memo',
          },
        ],
      },
    ];

    const withSuggestions = JSON.parse(
      generateJsonReport(results, { includeSuggestions: true })
    );
    const withoutSuggestions = JSON.parse(
      generateJsonReport(results, { includeSuggestions: false })
    );

    expect(withSuggestions.results[0].suggestions).toHaveLength(1);
    expect(withoutSuggestions.results[0].suggestions).toHaveLength(0);
  });
});

describe('parseJsonReport', () => {
  it('parses valid JSON report', () => {
    const results = [createResult('ComponentA', 'pass')];
    const json = generateJsonReport(results);

    const report = parseJsonReport(json);

    expect(report.version).toBe(VERSION);
    expect(report.results).toHaveLength(1);
  });
});

describe('isValidJsonReport', () => {
  it('returns true for valid report', () => {
    const report: TestReport = {
      version: VERSION,
      timestamp: Date.now(),
      status: 'pass',
      summary: {
        componentsTested: 1,
        contractsPassed: 1,
        contractsWarning: 0,
        contractsFailed: 0,
        regressionsDetected: 0,
      },
      results: [],
    };

    expect(isValidJsonReport(report)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidJsonReport(null)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isValidJsonReport('string')).toBe(false);
    expect(isValidJsonReport(123)).toBe(false);
  });

  it('returns false for missing version', () => {
    const report = {
      timestamp: Date.now(),
      status: 'pass',
      summary: {},
      results: [],
    };

    expect(isValidJsonReport(report)).toBe(false);
  });

  it('returns false for invalid status', () => {
    const report = {
      version: VERSION,
      timestamp: Date.now(),
      status: 'invalid',
      summary: {},
      results: [],
    };

    expect(isValidJsonReport(report)).toBe(false);
  });

  it('returns false for non-array results', () => {
    const report = {
      version: VERSION,
      timestamp: Date.now(),
      status: 'pass',
      summary: {},
      results: 'not-an-array',
    };

    expect(isValidJsonReport(report)).toBe(false);
  });
});

describe('mergeJsonReports', () => {
  it('merges multiple reports', () => {
    const report1: TestReport = {
      version: VERSION,
      timestamp: Date.now(),
      status: 'pass',
      summary: {
        componentsTested: 2,
        contractsPassed: 2,
        contractsWarning: 0,
        contractsFailed: 0,
        regressionsDetected: 0,
      },
      results: [
        createResult('ComponentA', 'pass'),
        createResult('ComponentB', 'pass'),
      ],
    };

    const report2: TestReport = {
      version: VERSION,
      timestamp: Date.now(),
      status: 'fail',
      summary: {
        componentsTested: 1,
        contractsPassed: 0,
        contractsWarning: 0,
        contractsFailed: 1,
        regressionsDetected: 1,
      },
      results: [createResult('ComponentC', 'fail')],
    };

    const merged = mergeJsonReports([report1, report2]);

    expect(merged.results).toHaveLength(3);
    expect(merged.summary.componentsTested).toBe(3);
    expect(merged.summary.contractsPassed).toBe(2);
    expect(merged.summary.contractsFailed).toBe(1);
    expect(merged.summary.regressionsDetected).toBe(1);
    expect(merged.status).toBe('fail'); // Overall status should be fail
  });

  it('throws error for empty array', () => {
    expect(() => mergeJsonReports([])).toThrow(
      'Cannot merge empty reports array'
    );
  });
});

describe('getFailedResults', () => {
  it('returns only failed results', () => {
    const report: TestReport = {
      version: VERSION,
      timestamp: Date.now(),
      status: 'fail',
      summary: {
        componentsTested: 3,
        contractsPassed: 1,
        contractsWarning: 1,
        contractsFailed: 1,
        regressionsDetected: 0,
      },
      results: [
        createResult('ComponentA', 'pass'),
        createResult('ComponentB', 'warn'),
        createResult('ComponentC', 'fail'),
      ],
    };

    const failed = getFailedResults(report);

    expect(failed).toHaveLength(1);
    expect(failed[0].componentName).toBe('ComponentC');
  });

  it('returns empty array when no failures', () => {
    const report: TestReport = {
      version: VERSION,
      timestamp: Date.now(),
      status: 'pass',
      summary: {
        componentsTested: 1,
        contractsPassed: 1,
        contractsWarning: 0,
        contractsFailed: 0,
        regressionsDetected: 0,
      },
      results: [createResult('ComponentA', 'pass')],
    };

    expect(getFailedResults(report)).toHaveLength(0);
  });
});

describe('getWarningResults', () => {
  it('returns only warning results', () => {
    const report: TestReport = {
      version: VERSION,
      timestamp: Date.now(),
      status: 'warn',
      summary: {
        componentsTested: 3,
        contractsPassed: 1,
        contractsWarning: 1,
        contractsFailed: 1,
        regressionsDetected: 0,
      },
      results: [
        createResult('ComponentA', 'pass'),
        createResult('ComponentB', 'warn'),
        createResult('ComponentC', 'fail'),
      ],
    };

    const warnings = getWarningResults(report);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].componentName).toBe('ComponentB');
  });
});

describe('createMinimalReport', () => {
  it('creates compact report structure', () => {
    const results = [
      createResult('ComponentA', 'pass'),
      createResult('ComponentB', 'fail', 2),
    ];

    const minimal = createMinimalReport(results) as {
      v: string;
      ts: number;
      s: string;
      sum: { t: number; p: number; w: number; f: number };
      r: Array<{ c: string; s: string; v: number }>;
    };

    expect(minimal.v).toBe(VERSION);
    expect(typeof minimal.ts).toBe('number');
    expect(minimal.s).toBe('fail');
    expect(minimal.sum.t).toBe(2);
    expect(minimal.sum.p).toBe(1);
    expect(minimal.sum.f).toBe(1);
    expect(minimal.r).toHaveLength(2);
    expect(minimal.r[1].v).toBe(2); // violations count
  });
});
