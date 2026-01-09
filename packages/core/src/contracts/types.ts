/**
 * Core type definitions for @samithahansaka/perflock
 */

// ============================================
// Contract Definition Types
// ============================================

/**
 * Interaction types that can be measured
 */
export type InteractionType =
  | 'click'
  | 'type'
  | 'scroll'
  | 'hover'
  | 'focus'
  | 'blur';

/**
 * Budget for a specific interaction type
 */
export interface InteractionBudget {
  /** Maximum renders allowed for this interaction */
  maxRenders: number;
  /** Maximum time in ms for renders triggered by this interaction */
  maxRenderTime?: number;
}

/**
 * Performance contract for a single component
 */
export interface ComponentContract {
  /** Maximum render time in milliseconds */
  maxRenderTime?: number;
  /** Maximum total render count per test scenario */
  maxRenderCount?: number;
  /** Maximum memory delta in MB */
  maxMemoryDelta?: number;
  /** Warning threshold as percentage of budget (0-1). Default: 0.8 */
  warningThreshold?: number;
  /** Per-interaction budgets */
  interactions?: Partial<Record<InteractionType, InteractionBudget>>;
  /** Custom metadata */
  meta?: Record<string, unknown>;
}

/**
 * Aggregate contract for a group of components
 */
export interface AggregateContract {
  /** Components included in this aggregate */
  components: string[];
  /** Maximum total render time across all components */
  maxTotalRenderTime?: number;
  /** Maximum total render count across all components */
  maxTotalRenderCount?: number;
}

/**
 * Global configuration settings
 */
export interface GlobalConfig {
  /** Number of test runs for statistical stability. Default: 10 */
  runs?: number;
  /** Number of warmup runs to discard. Default: 1 */
  warmupRuns?: number;
  /** Number of historical runs to compare against. Default: 20 */
  historyWindow?: number;
  /** Regression threshold as percentage (0-1). Default: 0.15 */
  regressionThreshold?: number;
  /** Output directory for results. Default: '.perf-contracts' */
  outputDir?: string;
  /** Artifact name for CI. Default: 'perf-results' */
  artifactName?: string;
  /** Bundle stats configuration */
  bundleStats?: {
    enabled: boolean;
    statsFile?: string;
  };
  /** Diagnostics configuration */
  diagnostics?: {
    enabled: boolean;
    suggestFixes?: boolean;
    sourceDir?: string;
  };
}

/**
 * Complete contract configuration
 */
export interface ContractConfig {
  global?: GlobalConfig;
  components?: Record<string, ComponentContract>;
  aggregates?: Record<string, AggregateContract>;
}

// ============================================
// Measurement Types
// ============================================

/**
 * Single render event captured by React.Profiler
 */
export interface RenderEvent {
  /** Render phase: 'mount', 'update', or 'nested-update' (React 18+) */
  phase: 'mount' | 'update' | 'nested-update';
  /** Actual time spent rendering */
  actualDuration: number;
  /** Estimated time for render without memoization */
  baseDuration: number;
  /** Time when render started */
  startTime: number;
  /** Time when render was committed */
  commitTime: number;
}

/**
 * Aggregated render metrics for a component
 */
export interface RenderMetrics {
  /** Component name */
  componentName: string;
  /** Total number of renders */
  renderCount: number;
  /** Sum of all actualDuration values */
  totalActualDuration: number;
  /** Sum of all baseDuration values */
  totalBaseDuration: number;
  /** Average render time */
  averageRenderTime: number;
  /** All render events */
  renders: RenderEvent[];
}

/**
 * Specification for an interaction to perform
 */
export interface InteractionSpec {
  /** Type of interaction */
  type: InteractionType;
  /** Target selector (CSS selector or data-testid) */
  target: string;
  /** Text to type (for 'type' interaction) */
  text?: string;
  /** Additional options */
  options?: Record<string, unknown>;
}

/**
 * Result of measuring a single interaction
 */
export interface InteractionResult {
  /** The interaction that was performed */
  interaction: InteractionSpec;
  /** Number of renders triggered by this interaction */
  rendersTriggered: number;
  /** Total render time for this interaction */
  totalRenderTime: number;
  /** Average render time per render */
  averageRenderTime: number;
}

/**
 * Complete measurement result
 */
export interface MeasurementResult {
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
  /** Memory delta if measured */
  memoryDelta?: number;
  /** Timestamp of measurement */
  timestamp: number;
  /** Run number (if multiple runs) */
  runNumber?: number;
}

/**
 * Statistical summary of multiple measurement runs
 */
export interface MeasurementStats {
  /** Mean value */
  mean: number;
  /** Median value */
  median: number;
  /** Standard deviation */
  stdDev: number;
  /** 95th percentile */
  p95: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Sample count */
  count: number;
}

/**
 * Aggregated results from multiple runs
 */
export interface AggregatedResult {
  componentName: string;
  renderTime: MeasurementStats;
  renderCount: MeasurementStats;
  rendersPerInteraction: Record<InteractionType, MeasurementStats>;
  memoryDelta?: MeasurementStats;
  runs: MeasurementResult[];
}

// ============================================
// Validation Types
// ============================================

/**
 * Status of a validation check
 */
export type ValidationStatus = 'pass' | 'warn' | 'fail';

/**
 * Single metric validation result
 */
export interface MetricValidation {
  /** Actual measured value */
  actual: number;
  /** Budget limit */
  budget: number;
  /** Utilization as percentage (actual/budget) */
  utilization: number;
  /** Validation status */
  status: ValidationStatus;
  /** Amount exceeded (if any) */
  exceededBy?: number;
}

/**
 * Complete validation result for a component
 */
export interface ValidationResult {
  /** Overall validation status */
  status: ValidationStatus;
  /** Component name */
  componentName: string;
  /** Per-metric validation results */
  metrics: {
    renderTime?: MetricValidation;
    renderCount?: MetricValidation;
    memoryDelta?: MetricValidation;
    rendersPerInteraction?: Partial<Record<InteractionType, MetricValidation>>;
  };
  /** List of violations */
  violations: Violation[];
  /** Suggested fixes */
  suggestions: FixSuggestion[];
}

/**
 * A specific budget violation
 */
export interface Violation {
  /** Metric that was violated */
  metric: string;
  /** Budget limit */
  budget: number;
  /** Actual value */
  actual: number;
  /** Percentage exceeded */
  exceededByPercent: number;
  /** Severity based on how much budget was exceeded */
  severity: 'minor' | 'moderate' | 'severe';
}

// ============================================
// Diagnostics Types
// ============================================

/**
 * Severity level for fix suggestions
 */
export type SuggestionSeverity = 'high' | 'medium' | 'low';

/**
 * A suggested code fix
 */
export interface FixSuggestion {
  /** Severity of the issue */
  severity: SuggestionSeverity;
  /** Line number in source file */
  line: number;
  /** Column number in source file */
  column?: number;
  /** Name of the detected anti-pattern */
  pattern: string;
  /** Human-readable description */
  description: string;
  /** Suggested fix */
  fix: string;
  /** Code snippet showing the issue */
  codeSnippet?: string;
  /** File path if available */
  filePath?: string;
}

/**
 * Result of AST analysis
 */
export interface AnalysisResult {
  /** File that was analyzed */
  filePath: string;
  /** Component name */
  componentName: string;
  /** All suggestions found */
  suggestions: FixSuggestion[];
  /** Patterns detected */
  patternsDetected: string[];
}

// ============================================
// Comparison Types
// ============================================

/**
 * Regression detected between baseline and current
 */
export interface Regression {
  /** Component name */
  componentName: string;
  /** Metric that regressed */
  metric: string;
  /** Baseline value */
  baseline: number;
  /** Current value */
  current: number;
  /** Percentage change */
  changePercent: number;
  /** Whether the change is statistically significant */
  significant: boolean;
}

/**
 * Result of comparing current results with baseline
 */
export interface ComparisonResult {
  /** Source of baseline data */
  baselineSource: 'artifacts' | 'branch' | 'file';
  /** Timestamp of baseline */
  baselineTimestamp?: number;
  /** All regressions detected */
  regressions: Regression[];
  /** All improvements detected */
  improvements: Regression[];
  /** Components that are new (no baseline) */
  newComponents: string[];
  /** Components that were removed */
  removedComponents: string[];
}

// ============================================
// Bundle Correlation Types
// ============================================

/**
 * Change in a bundle chunk
 */
export interface ChunkChange {
  /** Chunk name */
  name: string;
  /** Size change in bytes */
  sizeChange: number;
  /** Modules added to this chunk */
  addedModules: string[];
  /** Modules removed from this chunk */
  removedModules: string[];
}

/**
 * Suggested alternative for a heavy dependency
 */
export interface DependencyAlternative {
  /** Current dependency */
  dependency: string;
  /** Size of current dependency */
  currentSize: number;
  /** Suggested alternative */
  alternative: string;
  /** Size of alternative */
  alternativeSize: number;
  /** Potential savings */
  savings: number;
}

/**
 * Result of bundle-performance correlation analysis
 */
export interface BundleCorrelation {
  /** Whether a correlation was detected */
  hasCorrelation: boolean;
  /** Confidence level (0-1) */
  confidence: number;
  /** Changes in bundle chunks */
  chunkChanges: ChunkChange[];
  /** Suggested dependency alternatives */
  suggestedAlternatives: DependencyAlternative[];
}

// ============================================
// Report Types
// ============================================

/**
 * Summary of test results
 */
export interface ResultSummary {
  /** Total components tested */
  componentsTested: number;
  /** Components that passed all contracts */
  contractsPassed: number;
  /** Components with warnings */
  contractsWarning: number;
  /** Components that failed */
  contractsFailed: number;
  /** Number of regressions detected */
  regressionsDetected: number;
}

/**
 * Complete test report
 */
export interface TestReport {
  /** Report version */
  version: string;
  /** Timestamp of report generation */
  timestamp: number;
  /** Git commit SHA if available */
  commitSha?: string;
  /** Git branch if available */
  branch?: string;
  /** Overall status */
  status: ValidationStatus;
  /** Result summary */
  summary: ResultSummary;
  /** Per-component results */
  results: ValidationResult[];
  /** Comparison with baseline */
  comparison?: ComparisonResult;
  /** Bundle correlation analysis */
  bundleAnalysis?: BundleCorrelation;
}

// ============================================
// Utility Types
// ============================================

/**
 * Options for measureRenders function
 */
export interface MeasureRendersOptions {
  /** Test scenario to run */
  scenario?: (utils: {
    getByTestId: (id: string) => Element;
  }) => Promise<void> | void;
  /** Number of runs */
  runs?: number;
  /** Contract name to validate against */
  contract?: string;
}

/**
 * Options for measureInteraction function
 */
export interface MeasureInteractionOptions {
  /** Interactions to perform */
  interactions: InteractionSpec[];
  /** Contract name to validate against */
  contract?: string;
  /** Number of runs */
  runs?: number;
}

/**
 * Helper function type for defining contracts
 */
export type DefineContractsFunction = (
  config: ContractConfig
) => ContractConfig;
