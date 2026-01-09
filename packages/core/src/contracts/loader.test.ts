import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_GLOBAL_CONFIG,
  DEFAULT_COMPONENT_CONTRACT,
  resolveConfig,
  getComponentContract,
  hasContract,
  getContractedComponents,
  defineContracts,
  validateConfig,
  clearConfigCache,
  ConfigLoadError,
} from './loader';
import type { ContractConfig } from './types';

describe('DEFAULT_GLOBAL_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_GLOBAL_CONFIG.runs).toBe(10);
    expect(DEFAULT_GLOBAL_CONFIG.warmupRuns).toBe(1);
    expect(DEFAULT_GLOBAL_CONFIG.historyWindow).toBe(20);
    expect(DEFAULT_GLOBAL_CONFIG.regressionThreshold).toBe(0.15);
    expect(DEFAULT_GLOBAL_CONFIG.outputDir).toBe('.perf-contracts');
    expect(DEFAULT_GLOBAL_CONFIG.artifactName).toBe('perf-results');
    expect(DEFAULT_GLOBAL_CONFIG.bundleStats.enabled).toBe(false);
    expect(DEFAULT_GLOBAL_CONFIG.diagnostics.enabled).toBe(true);
  });
});

describe('DEFAULT_COMPONENT_CONTRACT', () => {
  it('has expected default warning threshold', () => {
    expect(DEFAULT_COMPONENT_CONTRACT.warningThreshold).toBe(0.8);
  });
});

describe('resolveConfig', () => {
  it('applies default global config when none provided', () => {
    const resolved = resolveConfig({});

    expect(resolved.global.runs).toBe(DEFAULT_GLOBAL_CONFIG.runs);
    expect(resolved.global.warmupRuns).toBe(DEFAULT_GLOBAL_CONFIG.warmupRuns);
    expect(resolved.global.regressionThreshold).toBe(
      DEFAULT_GLOBAL_CONFIG.regressionThreshold
    );
  });

  it('merges provided global config with defaults', () => {
    const resolved = resolveConfig({
      global: {
        runs: 5,
        regressionThreshold: 0.1,
      },
    });

    expect(resolved.global.runs).toBe(5);
    expect(resolved.global.regressionThreshold).toBe(0.1);
    expect(resolved.global.warmupRuns).toBe(DEFAULT_GLOBAL_CONFIG.warmupRuns);
  });

  it('resolves component contracts with defaults', () => {
    const resolved = resolveConfig({
      components: {
        UserCard: {
          maxRenderTime: 16,
        },
      },
    });

    const contract = resolved.components.get('UserCard');
    expect(contract).toBeDefined();
    expect(contract!.maxRenderTime).toBe(16);
    expect(contract!.maxRenderCount).toBe(Infinity);
    expect(contract!.warningThreshold).toBe(0.8);
  });

  it('resolves multiple component contracts', () => {
    const resolved = resolveConfig({
      components: {
        UserCard: { maxRenderTime: 16 },
        ProductList: { maxRenderCount: 5 },
        Header: { maxRenderTime: 8, maxRenderCount: 2 },
      },
    });

    expect(resolved.components.size).toBe(3);
    expect(resolved.components.get('UserCard')!.maxRenderTime).toBe(16);
    expect(resolved.components.get('ProductList')!.maxRenderCount).toBe(5);
    expect(resolved.components.get('Header')!.maxRenderTime).toBe(8);
  });

  it('resolves interaction budgets', () => {
    const resolved = resolveConfig({
      components: {
        UserCard: {
          maxRenderTime: 16,
          interactions: {
            click: { maxRenders: 2 },
            type: { maxRenders: 1 },
          },
        },
      },
    });

    const contract = resolved.components.get('UserCard');
    expect(contract!.interactions.click?.maxRenders).toBe(2);
    expect(contract!.interactions.type?.maxRenders).toBe(1);
  });

  it('resolves aggregates', () => {
    const resolved = resolveConfig({
      aggregates: {
        'all-cards': {
          components: ['UserCard', 'ProductCard'],
          maxTotalRenderTime: 100,
        },
      },
    });

    expect(resolved.aggregates.size).toBe(1);
    const aggregate = resolved.aggregates.get('all-cards');
    expect(aggregate!.components).toEqual(['UserCard', 'ProductCard']);
    expect(aggregate!.maxTotalRenderTime).toBe(100);
  });
});

describe('getComponentContract', () => {
  it('returns contract for existing component', () => {
    const resolved = resolveConfig({
      components: {
        UserCard: { maxRenderTime: 16 },
      },
    });

    const contract = getComponentContract(resolved, 'UserCard');

    expect(contract).toBeDefined();
    expect(contract!.maxRenderTime).toBe(16);
  });

  it('returns undefined for non-existent component', () => {
    const resolved = resolveConfig({
      components: {
        UserCard: { maxRenderTime: 16 },
      },
    });

    const contract = getComponentContract(resolved, 'NonExistent');

    expect(contract).toBeUndefined();
  });
});

describe('hasContract', () => {
  it('returns true for existing component', () => {
    const resolved = resolveConfig({
      components: {
        UserCard: { maxRenderTime: 16 },
      },
    });

    expect(hasContract(resolved, 'UserCard')).toBe(true);
  });

  it('returns false for non-existent component', () => {
    const resolved = resolveConfig({
      components: {
        UserCard: { maxRenderTime: 16 },
      },
    });

    expect(hasContract(resolved, 'NonExistent')).toBe(false);
  });
});

describe('getContractedComponents', () => {
  it('returns all component names', () => {
    const resolved = resolveConfig({
      components: {
        UserCard: { maxRenderTime: 16 },
        ProductList: { maxRenderCount: 5 },
        Header: { maxRenderTime: 8 },
      },
    });

    const names = getContractedComponents(resolved);

    expect(names).toHaveLength(3);
    expect(names).toContain('UserCard');
    expect(names).toContain('ProductList');
    expect(names).toContain('Header');
  });

  it('returns empty array when no components defined', () => {
    const resolved = resolveConfig({});

    const names = getContractedComponents(resolved);

    expect(names).toHaveLength(0);
  });
});

describe('defineContracts', () => {
  it('returns the config as-is (type helper)', () => {
    const config: ContractConfig = {
      global: { runs: 5 },
      components: {
        UserCard: { maxRenderTime: 16 },
      },
    };

    const result = defineContracts(config);

    expect(result).toEqual(config);
  });
});

describe('validateConfig', () => {
  it('returns empty array for valid config', () => {
    const errors = validateConfig({
      global: {
        runs: 10,
        regressionThreshold: 0.15,
      },
      components: {
        UserCard: {
          maxRenderTime: 16,
          maxRenderCount: 5,
          warningThreshold: 0.8,
        },
      },
    });

    expect(errors).toHaveLength(0);
  });

  it('validates global.runs is positive integer', () => {
    const errors = validateConfig({
      global: { runs: 0 },
    });

    expect(errors).toContain('global.runs must be a positive integer');
  });

  it('validates global.runs is integer', () => {
    const errors = validateConfig({
      global: { runs: 1.5 },
    });

    expect(errors).toContain('global.runs must be a positive integer');
  });

  it('validates global.regressionThreshold is between 0 and 1', () => {
    const errors1 = validateConfig({
      global: { regressionThreshold: -0.1 },
    });
    expect(errors1).toContain(
      'global.regressionThreshold must be between 0 and 1'
    );

    const errors2 = validateConfig({
      global: { regressionThreshold: 1.5 },
    });
    expect(errors2).toContain(
      'global.regressionThreshold must be between 0 and 1'
    );
  });

  it('validates global.historyWindow is positive integer', () => {
    const errors = validateConfig({
      global: { historyWindow: 0 },
    });

    expect(errors).toContain('global.historyWindow must be a positive integer');
  });

  it('validates component maxRenderTime is positive', () => {
    const errors = validateConfig({
      components: {
        UserCard: { maxRenderTime: -1 },
      },
    });

    expect(errors).toContain('UserCard.maxRenderTime must be positive');
  });

  it('validates component maxRenderCount is positive integer', () => {
    const errors = validateConfig({
      components: {
        UserCard: { maxRenderCount: 0 },
      },
    });

    expect(errors).toContain(
      'UserCard.maxRenderCount must be a positive integer'
    );
  });

  it('validates component warningThreshold is between 0 and 1', () => {
    const errors = validateConfig({
      components: {
        UserCard: { warningThreshold: 1.5 },
      },
    });

    expect(errors).toContain(
      'UserCard.warningThreshold must be between 0 and 1'
    );
  });

  it('validates interaction maxRenders is positive', () => {
    const errors = validateConfig({
      components: {
        UserCard: {
          interactions: {
            click: { maxRenders: 0 },
          },
        },
      },
    });

    expect(errors).toContain(
      'UserCard.interactions.click.maxRenders must be positive'
    );
  });

  it('validates aggregates have components', () => {
    const errors = validateConfig({
      aggregates: {
        'all-cards': {
          components: [],
          maxTotalRenderTime: 100,
        },
      },
    });

    expect(errors).toContain('all-cards.components must be a non-empty array');
  });

  it('accumulates multiple errors', () => {
    const errors = validateConfig({
      global: { runs: 0 },
      components: {
        UserCard: { maxRenderTime: -1 },
        ProductList: { maxRenderCount: 0 },
      },
    });

    expect(errors.length).toBeGreaterThan(2);
  });
});

describe('ConfigLoadError', () => {
  it('creates error with message', () => {
    const error = new ConfigLoadError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ConfigLoadError');
  });

  it('includes filepath', () => {
    const error = new ConfigLoadError('Test error', '/path/to/config');

    expect(error.filepath).toBe('/path/to/config');
  });

  it('includes cause', () => {
    const cause = new Error('Original error');
    const error = new ConfigLoadError('Test error', '/path/to/config', cause);

    expect(error.cause).toBe(cause);
  });
});

describe('clearConfigCache', () => {
  beforeEach(() => {
    clearConfigCache();
  });

  it('does not throw when called', () => {
    expect(() => clearConfigCache()).not.toThrow();
  });
});
