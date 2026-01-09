/**
 * @samithahansaka/perflock
 * Performance contracts for React components with CI enforcement
 */

// Types
export type {
  // Contract types
  ContractConfig,
  ComponentContract,
  GlobalConfig,
  AggregateContract,
  InteractionType,
  InteractionBudget,
  // Measurement types
  RenderEvent,
  RenderMetrics,
  InteractionSpec,
  InteractionResult,
  MeasurementResult,
  MeasurementStats,
  AggregatedResult,
  MeasureRendersOptions,
  MeasureInteractionOptions,
  // Validation types
  ValidationStatus,
  ValidationResult,
  MetricValidation,
  Violation,
  // Diagnostics types
  FixSuggestion,
  SuggestionSeverity,
  AnalysisResult,
  // Comparison types
  Regression,
  ComparisonResult,
  // Bundle types
  BundleCorrelation,
  ChunkChange,
  DependencyAlternative,
  // Report types
  TestReport,
  ResultSummary,
} from './contracts/types';

// Contract utilities
export {
  defineContracts,
  loadConfig,
  loadConfigSync,
  loadConfigFile,
  resolveConfig,
  getConfig,
  clearConfigCache,
  getConfigPath,
  getComponentContract,
  hasContract,
  getContractedComponents,
  validateConfig,
  DEFAULT_GLOBAL_CONFIG,
  DEFAULT_COMPONENT_CONTRACT,
  ConfigLoadError,
} from './contracts/loader';
export type { LoadedConfig, ResolvedConfig } from './contracts/loader';

// Validation
export {
  validateAgainstContract,
  validateContract,
  validateContractSync,
  passesContract,
  isWithinBudget,
  getBudgetUtilization,
  formatValidationSummary,
  validateMultiple,
  getOverallStatus,
  countByStatus,
  addSuggestions,
} from './contracts/validator';

// Measurement - Profiler
export {
  createProfiler,
  ProfilerWrapper,
  withProfiler,
  ProfilerProvider,
  useProfilerContext,
  useComponentProfiler,
  measureRendersWithProfiler,
} from './measurement/profiler';
export type {
  ProfilerInstance,
  ProfilerWrapperProps,
} from './measurement/profiler';

// Measurement - Interaction
export {
  measureInteraction,
  createInteractionMeasurer,
  interactions,
} from './measurement/interaction';
export type { MeasureInteractionResult } from './measurement/interaction';

// Reporters
export {
  generateJsonReport,
  generateJsonReportWithComparison,
  parseJsonReport,
  isValidJsonReport,
  mergeJsonReports,
  getFailedResults,
  getWarningResults,
  createMinimalReport,
  generateMarkdownReport,
  generateMarkdownReportWithComparison,
} from './reporters';
export type { JsonReportOptions, MarkdownReportOptions } from './reporters';

// Version
export const VERSION = '0.1.0';
