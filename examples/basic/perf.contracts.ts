import { defineContracts } from '@samithahansaka/perflock';

export default defineContracts({
  global: {
    runs: 10,
    warmupRuns: 1,
    historyWindow: 20,
    regressionThreshold: 0.15,
    outputDir: '.perf-contracts',
    diagnostics: {
      enabled: true,
      suggestFixes: true,
      sourceDir: 'src',
    },
  },

  components: {
    Button: {
      maxRenderTime: 8,
      maxRenderCount: 2,
      warningThreshold: 0.8,
    },

    UserCard: {
      maxRenderTime: 16,
      maxRenderCount: 3,
      interactions: {
        click: { maxRenders: 2 },
        type: { maxRenders: 1 },
      },
    },

    DataTable: {
      maxRenderTime: 100,
      maxRenderCount: 10,
    },

    SearchInput: {
      maxRenderTime: 12,
      maxRenderCount: 5,
      interactions: {
        type: { maxRenders: 1 },
        focus: { maxRenders: 1 },
        blur: { maxRenders: 1 },
      },
    },
  },

  aggregates: {
    'checkout-flow': {
      components: ['CartItem', 'CartSummary', 'PaymentForm'],
      maxTotalRenderTime: 50,
      maxTotalRenderCount: 15,
    },
  },
});
