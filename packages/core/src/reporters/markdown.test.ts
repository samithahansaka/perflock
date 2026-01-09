import { describe, it, expect } from 'vitest';
import { generateMarkdownReport } from './markdown';
import type { ValidationResult } from '../contracts/types';
import { VERSION } from '../index';

// Helper to create validation results
function createResult(
  componentName: string,
  status: 'pass' | 'warn' | 'fail',
  overrides: Partial<ValidationResult> = {}
): ValidationResult {
  return {
    componentName,
    status,
    metrics: {
      renderTime: {
        actual: status === 'pass' ? 10 : status === 'warn' ? 14 : 20,
        budget: 16,
        utilization:
          status === 'pass' ? 0.625 : status === 'warn' ? 0.875 : 1.25,
        status,
      },
    },
    violations:
      status === 'fail'
        ? [
            {
              metric: 'renderTime',
              budget: 16,
              actual: 20,
              exceededByPercent: 0.25,
              severity: 'minor',
            },
          ]
        : [],
    suggestions: [],
    ...overrides,
  };
}

describe('generateMarkdownReport', () => {
  it('generates markdown with header', () => {
    const results = [createResult('ComponentA', 'pass')];
    const markdown = generateMarkdownReport(results);

    expect(markdown).toContain('## Performance Contract Report');
  });

  it('includes version in footer', () => {
    const results = [createResult('ComponentA', 'pass')];
    const markdown = generateMarkdownReport(results);

    expect(markdown).toContain(`v${VERSION}`);
  });

  it('generates summary table', () => {
    const results = [
      createResult('ComponentA', 'pass'),
      createResult('ComponentB', 'warn'),
      createResult('ComponentC', 'fail'),
    ];
    const markdown = generateMarkdownReport(results);

    expect(markdown).toContain('Components Tested');
    expect(markdown).toContain('Passed');
    expect(markdown).toContain('Warnings');
    expect(markdown).toContain('Failed');
  });

  it('shows contract violations section for failures', () => {
    const results = [createResult('ComponentA', 'fail')];
    const markdown = generateMarkdownReport(results);

    expect(markdown).toContain('### Contract Violations');
    expect(markdown).toContain('ComponentA');
  });

  it('shows warnings section', () => {
    const results = [createResult('ComponentA', 'warn')];
    const markdown = generateMarkdownReport(results);

    expect(markdown).toContain('### Warnings');
    expect(markdown).toContain('ComponentA');
  });

  it('shows passing contracts section when enabled', () => {
    const results = [createResult('ComponentA', 'pass')];
    const markdown = generateMarkdownReport(results, {
      includePassingComponents: true,
    });

    expect(markdown).toContain('### Passing Contracts');
  });

  it('hides passing contracts when disabled', () => {
    const results = [createResult('ComponentA', 'pass')];
    const markdown = generateMarkdownReport(results, {
      includePassingComponents: false,
    });

    expect(markdown).not.toContain('### Passing Contracts');
  });

  it('uses collapsible sections when enabled', () => {
    const results = [createResult('ComponentA', 'pass')];
    const markdown = generateMarkdownReport(results, {
      collapseSections: true,
      includePassingComponents: true,
    });

    expect(markdown).toContain('<details>');
    expect(markdown).toContain('<summary>');
    expect(markdown).toContain('</details>');
  });

  it('includes status emojis', () => {
    const results = [
      createResult('ComponentA', 'pass'),
      createResult('ComponentB', 'warn'),
      createResult('ComponentC', 'fail'),
    ];
    const markdown = generateMarkdownReport(results);

    expect(markdown).toContain(':white_check_mark:');
    expect(markdown).toContain(':warning:');
    expect(markdown).toContain(':x:');
  });

  it('shows suggestions when included', () => {
    const results = [
      createResult('ComponentA', 'fail', {
        suggestions: [
          {
            severity: 'high',
            line: 42,
            pattern: 'missing-memo',
            description: 'Component re-renders on every parent update',
            fix: 'Consider using React.memo',
          },
        ],
      }),
    ];
    const markdown = generateMarkdownReport(results, {
      includeSuggestions: true,
    });

    expect(markdown).toContain('Consider using React.memo');
  });

  it('handles empty results', () => {
    const markdown = generateMarkdownReport([]);

    expect(markdown).toContain('## Performance Contract Report');
    expect(markdown).toContain('Components Tested');
  });

  it('includes violation details', () => {
    const results = [
      createResult('ComponentA', 'fail', {
        violations: [
          {
            metric: 'renderTime',
            budget: 16,
            actual: 32,
            exceededByPercent: 1.0,
            severity: 'severe',
          },
        ],
      }),
    ];
    const markdown = generateMarkdownReport(results);

    expect(markdown).toContain('Render Time');
    expect(markdown).toContain('Exceeded');
  });

  it('shows metrics table for components', () => {
    const results = [createResult('ComponentA', 'fail')];
    const markdown = generateMarkdownReport(results);

    expect(markdown).toContain('Metric');
    expect(markdown).toContain('Actual');
    expect(markdown).toContain('Budget');
  });

  it('limits suggestions per component', () => {
    const suggestions = Array(10)
      .fill(null)
      .map((_, i) => ({
        severity: 'medium' as const,
        line: 10 + i,
        pattern: 'test-pattern',
        description: `Description ${i}`,
        fix: `Fix suggestion ${i}`,
      }));

    const results = [createResult('ComponentA', 'fail', { suggestions })];

    const markdown = generateMarkdownReport(results, {
      maxSuggestionsPerComponent: 3,
      includeSuggestions: true,
    });

    // Should show limited suggestions
    const suggestionMatches = markdown.match(/Fix suggestion \d/g) || [];
    expect(suggestionMatches.length).toBeLessThanOrEqual(3);
  });
});

describe('generateMarkdownReport options', () => {
  it('respects all default options', () => {
    const results = [createResult('ComponentA', 'pass')];
    const markdown = generateMarkdownReport(results);

    // Default: includeSuggestions: true
    // Default: includePassingComponents: true
    // Default: collapseSections: true
    expect(markdown).toContain('### Passing Contracts');
    expect(markdown).toContain('<details>');
  });

  it('can override multiple options', () => {
    const results = [
      createResult('ComponentA', 'pass'),
      createResult('ComponentB', 'fail'),
    ];

    const markdown = generateMarkdownReport(results, {
      includePassingComponents: false,
      includeSuggestions: false,
      collapseSections: false,
    });

    expect(markdown).not.toContain('### Passing Contracts');
    expect(markdown).not.toContain('<details>');
  });
});
