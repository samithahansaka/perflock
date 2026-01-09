/**
 * JSON Reporter
 * Generates JSON output for CI artifacts and API consumption
 */

import type {
  TestReport,
  ValidationResult,
  ResultSummary,
  ComparisonResult,
  BundleCorrelation,
} from '../contracts/types';
import { VERSION } from '../index';
import { countByStatus, getOverallStatus } from '../contracts/validator';

/**
 * Options for JSON report generation
 */
export interface JsonReportOptions {
  /** Include all render events (can be large) */
  includeRenderEvents?: boolean;
  /** Include fix suggestions */
  includeSuggestions?: boolean;
  /** Pretty print JSON */
  prettyPrint?: boolean;
  /** Indent size for pretty print */
  indentSize?: number;
}

const DEFAULT_OPTIONS: JsonReportOptions = {
  includeRenderEvents: false,
  includeSuggestions: true,
  prettyPrint: true,
  indentSize: 2,
};

/**
 * Generate JSON report from validation results
 */
export function generateJsonReport(
  results: ValidationResult[],
  options: JsonReportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const summary = createSummary(results);
  const status = getOverallStatus(results);

  const report: TestReport = {
    version: VERSION,
    timestamp: Date.now(),
    commitSha: getCommitSha(),
    branch: getBranch(),
    status,
    summary,
    results: opts.includeSuggestions
      ? results
      : results.map((r) => ({ ...r, suggestions: [] })),
  };

  if (opts.prettyPrint) {
    return JSON.stringify(report, null, opts.indentSize);
  }

  return JSON.stringify(report);
}

/**
 * Generate JSON report with comparison data
 */
export function generateJsonReportWithComparison(
  results: ValidationResult[],
  comparison: ComparisonResult,
  bundleAnalysis?: BundleCorrelation,
  options: JsonReportOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const summary = createSummary(results);
  summary.regressionsDetected = comparison.regressions.length;

  const status = getOverallStatus(results);

  const report: TestReport = {
    version: VERSION,
    timestamp: Date.now(),
    commitSha: getCommitSha(),
    branch: getBranch(),
    status,
    summary,
    results: opts.includeSuggestions
      ? results
      : results.map((r) => ({ ...r, suggestions: [] })),
    comparison,
    bundleAnalysis,
  };

  if (opts.prettyPrint) {
    return JSON.stringify(report, null, opts.indentSize);
  }

  return JSON.stringify(report);
}

/**
 * Create summary from results
 */
function createSummary(results: ValidationResult[]): ResultSummary {
  const counts = countByStatus(results);

  return {
    componentsTested: results.length,
    contractsPassed: counts.pass,
    contractsWarning: counts.warn,
    contractsFailed: counts.fail,
    regressionsDetected: 0,
  };
}

/**
 * Get git commit SHA if available
 */
function getCommitSha(): string | undefined {
  return (
    process.env.GITHUB_SHA ||
    process.env.CI_COMMIT_SHA ||
    process.env.GIT_COMMIT ||
    undefined
  );
}

/**
 * Get git branch if available
 */
function getBranch(): string | undefined {
  return (
    process.env.GITHUB_REF_NAME ||
    process.env.GITHUB_HEAD_REF ||
    process.env.CI_COMMIT_BRANCH ||
    process.env.GIT_BRANCH ||
    undefined
  );
}

/**
 * Parse JSON report from string
 */
export function parseJsonReport(json: string): TestReport {
  return JSON.parse(json) as TestReport;
}

/**
 * Validate JSON report structure
 */
export function isValidJsonReport(data: unknown): data is TestReport {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const report = data as Partial<TestReport>;

  return (
    typeof report.version === 'string' &&
    typeof report.timestamp === 'number' &&
    typeof report.status === 'string' &&
    ['pass', 'warn', 'fail'].includes(report.status) &&
    typeof report.summary === 'object' &&
    Array.isArray(report.results)
  );
}

/**
 * Merge multiple JSON reports
 */
export function mergeJsonReports(reports: TestReport[]): TestReport {
  if (reports.length === 0) {
    throw new Error('Cannot merge empty reports array');
  }

  const allResults: ValidationResult[] = [];
  let totalTested = 0;
  let totalPassed = 0;
  let totalWarning = 0;
  let totalFailed = 0;
  let totalRegressions = 0;

  for (const report of reports) {
    allResults.push(...report.results);
    totalTested += report.summary.componentsTested;
    totalPassed += report.summary.contractsPassed;
    totalWarning += report.summary.contractsWarning;
    totalFailed += report.summary.contractsFailed;
    totalRegressions += report.summary.regressionsDetected;
  }

  const status = getOverallStatus(allResults);

  return {
    version: VERSION,
    timestamp: Date.now(),
    status,
    summary: {
      componentsTested: totalTested,
      contractsPassed: totalPassed,
      contractsWarning: totalWarning,
      contractsFailed: totalFailed,
      regressionsDetected: totalRegressions,
    },
    results: allResults,
  };
}

/**
 * Extract failed results from report
 */
export function getFailedResults(report: TestReport): ValidationResult[] {
  return report.results.filter((r) => r.status === 'fail');
}

/**
 * Extract results with warnings from report
 */
export function getWarningResults(report: TestReport): ValidationResult[] {
  return report.results.filter((r) => r.status === 'warn');
}

/**
 * Create a minimal report for storage
 */
export function createMinimalReport(results: ValidationResult[]): object {
  const summary = createSummary(results);
  const status = getOverallStatus(results);

  return {
    v: VERSION,
    ts: Date.now(),
    s: status,
    sum: {
      t: summary.componentsTested,
      p: summary.contractsPassed,
      w: summary.contractsWarning,
      f: summary.contractsFailed,
    },
    r: results.map((r) => ({
      c: r.componentName,
      s: r.status,
      v: r.violations.length,
    })),
  };
}
