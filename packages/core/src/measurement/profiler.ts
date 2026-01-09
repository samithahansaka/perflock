/**
 * React.Profiler wrapper for capturing render metrics
 */

import React, { Profiler, ReactElement, ReactNode } from 'react';
import type { RenderEvent, RenderMetrics } from '../contracts/types';

/**
 * Profiler instance with metrics collection
 */
export interface ProfilerInstance {
  /** Collected metrics */
  metrics: RenderMetrics;
  /** React.Profiler onRender callback */
  onRenderCallback: React.ProfilerOnRenderCallback;
  /** Reset collected metrics */
  reset: () => void;
  /** Get snapshot of current metrics */
  getSnapshot: () => RenderMetrics;
}

/**
 * Creates a profiler instance for tracking render metrics
 */
export function createProfiler(componentName: string): ProfilerInstance {
  const metrics: RenderMetrics = {
    componentName,
    renderCount: 0,
    totalActualDuration: 0,
    totalBaseDuration: 0,
    averageRenderTime: 0,
    renders: [],
  };

  const onRenderCallback: React.ProfilerOnRenderCallback = (
    _id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    const renderEvent: RenderEvent = {
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
    };

    metrics.renderCount++;
    metrics.totalActualDuration += actualDuration;
    metrics.totalBaseDuration += baseDuration;
    metrics.renders.push(renderEvent);
    metrics.averageRenderTime = metrics.totalActualDuration / metrics.renderCount;
  };

  const reset = () => {
    metrics.renderCount = 0;
    metrics.totalActualDuration = 0;
    metrics.totalBaseDuration = 0;
    metrics.averageRenderTime = 0;
    metrics.renders = [];
  };

  const getSnapshot = (): RenderMetrics => ({
    ...metrics,
    renders: [...metrics.renders],
  });

  return {
    metrics,
    onRenderCallback,
    reset,
    getSnapshot,
  };
}

/**
 * Props for ProfilerWrapper component
 */
export interface ProfilerWrapperProps {
  /** Unique identifier for the profiler */
  id: string;
  /** Profiler instance to collect metrics */
  profiler: ProfilerInstance;
  /** Children to profile */
  children: ReactNode;
}

/**
 * Wrapper component that profiles its children
 */
export function ProfilerWrapper({
  id,
  profiler,
  children,
}: ProfilerWrapperProps): ReactElement {
  return React.createElement(
    Profiler,
    {
      id,
      onRender: profiler.onRenderCallback,
    },
    children
  );
}

/**
 * Higher-order component for profiling
 */
export function withProfiler<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P & { profilerRef?: React.MutableRefObject<ProfilerInstance | null> }> {
  const profiler = createProfiler(componentName);

  const ProfiledComponent = React.forwardRef<
    ProfilerInstance,
    P & { profilerRef?: React.MutableRefObject<ProfilerInstance | null> }
  >((props, ref) => {
    const { profilerRef, ...rest } = props;

    // Expose profiler instance via ref
    React.useImperativeHandle(ref, () => profiler, []);

    // Also set via mutable ref prop if provided
    React.useEffect(() => {
      if (profilerRef) {
        profilerRef.current = profiler;
      }
    }, [profilerRef]);

    return React.createElement(
      Profiler,
      {
        id: componentName,
        onRender: profiler.onRenderCallback,
      },
      React.createElement(WrappedComponent, rest as P)
    );
  });

  ProfiledComponent.displayName = `Profiled(${componentName})`;

  return ProfiledComponent as unknown as React.ComponentType<
    P & { profilerRef?: React.MutableRefObject<ProfilerInstance | null> }
  >;
}

/**
 * Context for sharing profiler metrics across components
 */
export interface ProfilerContextValue {
  /** Register a render event */
  recordRender: (componentName: string, event: RenderEvent) => void;
  /** Get metrics for a component */
  getMetrics: (componentName: string) => RenderMetrics | undefined;
  /** Get all metrics */
  getAllMetrics: () => Map<string, RenderMetrics>;
  /** Reset all metrics */
  resetAll: () => void;
}

const ProfilerContext = React.createContext<ProfilerContextValue | null>(null);

/**
 * Provider for profiler context
 */
export function ProfilerProvider({ children }: { children: ReactNode }): ReactElement {
  const metricsMap = React.useRef<Map<string, RenderMetrics>>(new Map());

  const contextValue: ProfilerContextValue = React.useMemo(
    () => ({
      recordRender: (componentName: string, event: RenderEvent) => {
        let metrics = metricsMap.current.get(componentName);
        if (!metrics) {
          metrics = {
            componentName,
            renderCount: 0,
            totalActualDuration: 0,
            totalBaseDuration: 0,
            averageRenderTime: 0,
            renders: [],
          };
          metricsMap.current.set(componentName, metrics);
        }

        metrics.renderCount++;
        metrics.totalActualDuration += event.actualDuration;
        metrics.totalBaseDuration += event.baseDuration;
        metrics.renders.push(event);
        metrics.averageRenderTime = metrics.totalActualDuration / metrics.renderCount;
      },

      getMetrics: (componentName: string) => {
        const metrics = metricsMap.current.get(componentName);
        if (!metrics) return undefined;
        return { ...metrics, renders: [...metrics.renders] };
      },

      getAllMetrics: () => new Map(metricsMap.current),

      resetAll: () => {
        metricsMap.current.clear();
      },
    }),
    []
  );

  return React.createElement(ProfilerContext.Provider, { value: contextValue }, children);
}

/**
 * Hook to access profiler context
 */
export function useProfilerContext(): ProfilerContextValue {
  const context = React.useContext(ProfilerContext);
  if (!context) {
    throw new Error('useProfilerContext must be used within a ProfilerProvider');
  }
  return context;
}

/**
 * Hook to profile a specific component by name
 */
export function useComponentProfiler(componentName: string): {
  onRender: React.ProfilerOnRenderCallback;
  metrics: RenderMetrics | undefined;
} {
  const context = useProfilerContext();

  const onRender: React.ProfilerOnRenderCallback = React.useCallback(
    (
      _id: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      context.recordRender(componentName, {
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      });
    },
    [context, componentName]
  );

  return {
    onRender,
    metrics: context.getMetrics(componentName),
  };
}

/**
 * Measure renders during a test scenario
 */
export async function measureRendersWithProfiler<T>(
  renderFn: () => T,
  scenario?: () => Promise<void> | void,
  options: { runs?: number; warmupRuns?: number } = {}
): Promise<{
  result: T;
  metrics: RenderMetrics;
  allRuns: RenderMetrics[];
}> {
  const { runs = 1, warmupRuns = 0 } = options;
  const profiler = createProfiler('measured-component');
  const allRuns: RenderMetrics[] = [];

  let result: T;

  // Warmup runs
  for (let i = 0; i < warmupRuns; i++) {
    profiler.reset();
    result = renderFn();
    if (scenario) {
      await scenario();
    }
  }

  // Actual measurement runs
  for (let i = 0; i < runs; i++) {
    profiler.reset();
    result = renderFn();
    if (scenario) {
      await scenario();
    }
    allRuns.push(profiler.getSnapshot());
  }

  // Calculate aggregated metrics
  const aggregatedMetrics: RenderMetrics = {
    componentName: 'measured-component',
    renderCount: 0,
    totalActualDuration: 0,
    totalBaseDuration: 0,
    averageRenderTime: 0,
    renders: [],
  };

  for (const run of allRuns) {
    aggregatedMetrics.renderCount += run.renderCount;
    aggregatedMetrics.totalActualDuration += run.totalActualDuration;
    aggregatedMetrics.totalBaseDuration += run.totalBaseDuration;
    aggregatedMetrics.renders.push(...run.renders);
  }

  if (aggregatedMetrics.renderCount > 0) {
    aggregatedMetrics.averageRenderTime =
      aggregatedMetrics.totalActualDuration / aggregatedMetrics.renderCount;
  }

  return {
    result: result!,
    metrics: aggregatedMetrics,
    allRuns,
  };
}
