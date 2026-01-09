/**
 * Reporter exports
 */

export {
  generateJsonReport,
  generateJsonReportWithComparison,
  parseJsonReport,
  isValidJsonReport,
  mergeJsonReports,
  getFailedResults,
  getWarningResults,
  createMinimalReport,
} from './json';
export type { JsonReportOptions } from './json';

export {
  generateMarkdownReport,
  generateMarkdownReportWithComparison,
} from './markdown';
export type { MarkdownReportOptions } from './markdown';
