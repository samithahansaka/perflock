/**
 * Contract configuration loader
 * Uses cosmiconfig for flexible config file support
 */

import { cosmiconfig, cosmiconfigSync } from 'cosmiconfig';
import type {
  ContractConfig,
  ComponentContract,
  GlobalConfig,
  AggregateContract,
} from './types';

/**
 * Default global configuration values
 */
export const DEFAULT_GLOBAL_CONFIG: Required<GlobalConfig> = {
  runs: 10,
  warmupRuns: 1,
  historyWindow: 20,
  regressionThreshold: 0.15,
  outputDir: '.perf-contracts',
  artifactName: 'perf-results',
  bundleStats: {
    enabled: false,
    statsFile: undefined,
  },
  diagnostics: {
    enabled: true,
    suggestFixes: true,
    sourceDir: 'src',
  },
};

/**
 * Default component contract values
 */
export const DEFAULT_COMPONENT_CONTRACT: Partial<ComponentContract> = {
  warningThreshold: 0.8,
};

/**
 * Module name for cosmiconfig
 */
const MODULE_NAME = 'perf-contracts';

/**
 * Supported config file names
 */
const SEARCH_PLACES = [
  'perf.contracts.ts',
  'perf.contracts.js',
  'perf.contracts.mjs',
  'perf.contracts.cjs',
  'perf-contracts.config.ts',
  'perf-contracts.config.js',
  'perf-contracts.config.mjs',
  'perf-contracts.config.cjs',
  '.perf-contractsrc',
  '.perf-contractsrc.json',
  '.perf-contractsrc.yaml',
  '.perf-contractsrc.yml',
  'package.json',
];

/**
 * Loaded configuration result
 */
export interface LoadedConfig {
  /** The configuration object */
  config: ContractConfig;
  /** Path to the config file */
  filepath: string;
  /** Whether config was found */
  isEmpty: boolean;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedConfig {
  global: Required<GlobalConfig>;
  components: Map<string, Required<ComponentContract>>;
  aggregates: Map<string, AggregateContract>;
}

/**
 * Configuration loading error
 */
export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly filepath?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Create the cosmiconfig explorer
 */
function createExplorer() {
  return cosmiconfig(MODULE_NAME, {
    searchPlaces: SEARCH_PLACES,
    loaders: {
      '.ts': async (filepath: string) => {
        // Dynamic import for TypeScript files
        try {
          const module = await import(filepath);
          return module.default || module;
        } catch (error) {
          throw new ConfigLoadError(
            `Failed to load TypeScript config: ${filepath}`,
            filepath,
            error as Error
          );
        }
      },
    },
  });
}

/**
 * Create the sync cosmiconfig explorer
 */
function createExplorerSync() {
  return cosmiconfigSync(MODULE_NAME, {
    searchPlaces: SEARCH_PLACES,
  });
}

/**
 * Load configuration asynchronously
 *
 * @param searchFrom - Directory to start searching from
 * @returns Loaded configuration or null if not found
 */
export async function loadConfig(
  searchFrom?: string
): Promise<LoadedConfig | null> {
  const explorer = createExplorer();

  try {
    const result = searchFrom
      ? await explorer.search(searchFrom)
      : await explorer.search();

    if (!result || result.isEmpty) {
      return null;
    }

    return {
      config: result.config as ContractConfig,
      filepath: result.filepath,
      isEmpty: result.isEmpty ?? false,
    };
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      throw error;
    }
    throw new ConfigLoadError(
      'Failed to load configuration',
      undefined,
      error as Error
    );
  }
}

/**
 * Load configuration synchronously
 *
 * @param searchFrom - Directory to start searching from
 * @returns Loaded configuration or null if not found
 */
export function loadConfigSync(searchFrom?: string): LoadedConfig | null {
  const explorer = createExplorerSync();

  try {
    const result = searchFrom
      ? explorer.search(searchFrom)
      : explorer.search();

    if (!result || result.isEmpty) {
      return null;
    }

    return {
      config: result.config as ContractConfig,
      filepath: result.filepath,
      isEmpty: result.isEmpty ?? false,
    };
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      throw error;
    }
    throw new ConfigLoadError(
      'Failed to load configuration',
      undefined,
      error as Error
    );
  }
}

/**
 * Load configuration from a specific file path
 *
 * @param filepath - Path to the config file
 * @returns Loaded configuration
 */
export async function loadConfigFile(filepath: string): Promise<LoadedConfig> {
  const explorer = createExplorer();

  try {
    const result = await explorer.load(filepath);

    if (!result) {
      throw new ConfigLoadError(`Config file not found: ${filepath}`, filepath);
    }

    return {
      config: result.config as ContractConfig,
      filepath: result.filepath,
      isEmpty: result.isEmpty ?? false,
    };
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      throw error;
    }
    throw new ConfigLoadError(
      `Failed to load config file: ${filepath}`,
      filepath,
      error as Error
    );
  }
}

/**
 * Resolve a component contract with default values
 */
function resolveComponentContract(
  contract: ComponentContract
): Required<ComponentContract> {
  return {
    maxRenderTime: contract.maxRenderTime ?? Infinity,
    maxRenderCount: contract.maxRenderCount ?? Infinity,
    maxMemoryDelta: contract.maxMemoryDelta ?? Infinity,
    warningThreshold:
      contract.warningThreshold ?? DEFAULT_COMPONENT_CONTRACT.warningThreshold!,
    interactions: contract.interactions ?? {},
    meta: contract.meta ?? {},
  };
}

/**
 * Resolve global config with default values
 */
function resolveGlobalConfig(config?: GlobalConfig): Required<GlobalConfig> {
  return {
    runs: config?.runs ?? DEFAULT_GLOBAL_CONFIG.runs,
    warmupRuns: config?.warmupRuns ?? DEFAULT_GLOBAL_CONFIG.warmupRuns,
    historyWindow: config?.historyWindow ?? DEFAULT_GLOBAL_CONFIG.historyWindow,
    regressionThreshold:
      config?.regressionThreshold ?? DEFAULT_GLOBAL_CONFIG.regressionThreshold,
    outputDir: config?.outputDir ?? DEFAULT_GLOBAL_CONFIG.outputDir,
    artifactName: config?.artifactName ?? DEFAULT_GLOBAL_CONFIG.artifactName,
    bundleStats: {
      enabled: config?.bundleStats?.enabled ?? DEFAULT_GLOBAL_CONFIG.bundleStats.enabled,
      statsFile: config?.bundleStats?.statsFile,
    },
    diagnostics: {
      enabled:
        config?.diagnostics?.enabled ?? DEFAULT_GLOBAL_CONFIG.diagnostics.enabled,
      suggestFixes:
        config?.diagnostics?.suggestFixes ??
        DEFAULT_GLOBAL_CONFIG.diagnostics.suggestFixes,
      sourceDir:
        config?.diagnostics?.sourceDir ?? DEFAULT_GLOBAL_CONFIG.diagnostics.sourceDir,
    },
  };
}

/**
 * Resolve configuration with all defaults applied
 *
 * @param config - Raw configuration
 * @returns Resolved configuration with defaults
 */
export function resolveConfig(config: ContractConfig): ResolvedConfig {
  const global = resolveGlobalConfig(config.global);

  const components = new Map<string, Required<ComponentContract>>();
  if (config.components) {
    for (const [name, contract] of Object.entries(config.components)) {
      components.set(name, resolveComponentContract(contract));
    }
  }

  const aggregates = new Map<string, AggregateContract>();
  if (config.aggregates) {
    for (const [name, aggregate] of Object.entries(config.aggregates)) {
      aggregates.set(name, aggregate);
    }
  }

  return { global, components, aggregates };
}

/**
 * Get a specific component contract
 *
 * @param config - Resolved configuration
 * @param componentName - Name of the component
 * @returns Component contract or undefined if not found
 */
export function getComponentContract(
  config: ResolvedConfig,
  componentName: string
): Required<ComponentContract> | undefined {
  return config.components.get(componentName);
}

/**
 * Check if a component has a contract defined
 */
export function hasContract(
  config: ResolvedConfig,
  componentName: string
): boolean {
  return config.components.has(componentName);
}

/**
 * Get all component names with contracts
 */
export function getContractedComponents(config: ResolvedConfig): string[] {
  return Array.from(config.components.keys());
}

/**
 * Helper function for defining contracts with type safety
 */
export function defineContracts(config: ContractConfig): ContractConfig {
  return config;
}

/**
 * Validate configuration structure
 */
export function validateConfig(config: ContractConfig): string[] {
  const errors: string[] = [];

  // Validate global config
  if (config.global) {
    if (
      config.global.runs !== undefined &&
      (config.global.runs < 1 || !Number.isInteger(config.global.runs))
    ) {
      errors.push('global.runs must be a positive integer');
    }

    if (
      config.global.regressionThreshold !== undefined &&
      (config.global.regressionThreshold < 0 || config.global.regressionThreshold > 1)
    ) {
      errors.push('global.regressionThreshold must be between 0 and 1');
    }

    if (
      config.global.historyWindow !== undefined &&
      (config.global.historyWindow < 1 ||
        !Number.isInteger(config.global.historyWindow))
    ) {
      errors.push('global.historyWindow must be a positive integer');
    }
  }

  // Validate component contracts
  if (config.components) {
    for (const [name, contract] of Object.entries(config.components)) {
      if (
        contract.maxRenderTime !== undefined &&
        contract.maxRenderTime <= 0
      ) {
        errors.push(`${name}.maxRenderTime must be positive`);
      }

      if (
        contract.maxRenderCount !== undefined &&
        (contract.maxRenderCount <= 0 ||
          !Number.isInteger(contract.maxRenderCount))
      ) {
        errors.push(`${name}.maxRenderCount must be a positive integer`);
      }

      if (
        contract.warningThreshold !== undefined &&
        (contract.warningThreshold < 0 || contract.warningThreshold > 1)
      ) {
        errors.push(`${name}.warningThreshold must be between 0 and 1`);
      }

      if (contract.interactions) {
        for (const [interaction, budget] of Object.entries(
          contract.interactions
        )) {
          if (budget.maxRenders !== undefined && budget.maxRenders <= 0) {
            errors.push(
              `${name}.interactions.${interaction}.maxRenders must be positive`
            );
          }
        }
      }
    }
  }

  // Validate aggregates
  if (config.aggregates) {
    for (const [name, aggregate] of Object.entries(config.aggregates)) {
      if (!aggregate.components || aggregate.components.length === 0) {
        errors.push(`${name}.components must be a non-empty array`);
      }
    }
  }

  return errors;
}

/**
 * Configuration cache for performance
 */
let cachedConfig: ResolvedConfig | null = null;
let cachedConfigPath: string | null = null;

/**
 * Get or load configuration (with caching)
 */
export async function getConfig(
  searchFrom?: string,
  forceReload = false
): Promise<ResolvedConfig> {
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  const loaded = await loadConfig(searchFrom);

  if (!loaded) {
    // Return empty config with defaults
    cachedConfig = resolveConfig({});
    cachedConfigPath = null;
    return cachedConfig;
  }

  // Validate
  const errors = validateConfig(loaded.config);
  if (errors.length > 0) {
    throw new ConfigLoadError(
      `Invalid configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
      loaded.filepath
    );
  }

  cachedConfig = resolveConfig(loaded.config);
  cachedConfigPath = loaded.filepath;

  return cachedConfig;
}

/**
 * Clear configuration cache
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  cachedConfigPath = null;
}

/**
 * Get the path to the loaded config file
 */
export function getConfigPath(): string | null {
  return cachedConfigPath;
}
