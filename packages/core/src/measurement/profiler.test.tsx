import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  createProfiler,
  ProfilerWrapper,
  withProfiler,
  ProfilerProvider,
  useProfilerContext,
  useComponentProfiler,
} from './profiler';

describe('createProfiler', () => {
  it('creates profiler with initial metrics', () => {
    const profiler = createProfiler('TestComponent');

    expect(profiler.metrics.componentName).toBe('TestComponent');
    expect(profiler.metrics.renderCount).toBe(0);
    expect(profiler.metrics.totalActualDuration).toBe(0);
    expect(profiler.metrics.totalBaseDuration).toBe(0);
    expect(profiler.metrics.averageRenderTime).toBe(0);
    expect(profiler.metrics.renders).toHaveLength(0);
  });

  it('provides onRenderCallback function', () => {
    const profiler = createProfiler('TestComponent');

    expect(typeof profiler.onRenderCallback).toBe('function');
  });

  it('provides reset function', () => {
    const profiler = createProfiler('TestComponent');

    expect(typeof profiler.reset).toBe('function');
  });

  it('provides getSnapshot function', () => {
    const profiler = createProfiler('TestComponent');

    expect(typeof profiler.getSnapshot).toBe('function');
  });
});

describe('profiler onRenderCallback', () => {
  it('tracks render events', () => {
    const profiler = createProfiler('TestComponent');

    // Simulate a render event
    profiler.onRenderCallback(
      'TestComponent',
      'mount',
      10, // actualDuration
      15, // baseDuration
      100, // startTime
      110 // commitTime
    );

    expect(profiler.metrics.renderCount).toBe(1);
    expect(profiler.metrics.totalActualDuration).toBe(10);
    expect(profiler.metrics.totalBaseDuration).toBe(15);
    expect(profiler.metrics.averageRenderTime).toBe(10);
    expect(profiler.metrics.renders).toHaveLength(1);
  });

  it('accumulates multiple render events', () => {
    const profiler = createProfiler('TestComponent');

    // First render (mount)
    profiler.onRenderCallback('TestComponent', 'mount', 10, 15, 100, 110);

    // Second render (update)
    profiler.onRenderCallback('TestComponent', 'update', 5, 8, 200, 205);

    expect(profiler.metrics.renderCount).toBe(2);
    expect(profiler.metrics.totalActualDuration).toBe(15);
    expect(profiler.metrics.totalBaseDuration).toBe(23);
    expect(profiler.metrics.averageRenderTime).toBe(7.5);
    expect(profiler.metrics.renders).toHaveLength(2);
  });

  it('records render event details', () => {
    const profiler = createProfiler('TestComponent');

    profiler.onRenderCallback('TestComponent', 'mount', 10, 15, 100, 110);

    const renderEvent = profiler.metrics.renders[0];
    expect(renderEvent.phase).toBe('mount');
    expect(renderEvent.actualDuration).toBe(10);
    expect(renderEvent.baseDuration).toBe(15);
    expect(renderEvent.startTime).toBe(100);
    expect(renderEvent.commitTime).toBe(110);
  });

  it('handles nested-update phase', () => {
    const profiler = createProfiler('TestComponent');

    profiler.onRenderCallback('TestComponent', 'nested-update', 3, 5, 300, 303);

    expect(profiler.metrics.renders[0].phase).toBe('nested-update');
  });
});

describe('profiler reset', () => {
  it('resets all metrics to initial state', () => {
    const profiler = createProfiler('TestComponent');

    // Add some render events
    profiler.onRenderCallback('TestComponent', 'mount', 10, 15, 100, 110);
    profiler.onRenderCallback('TestComponent', 'update', 5, 8, 200, 205);

    // Reset
    profiler.reset();

    expect(profiler.metrics.renderCount).toBe(0);
    expect(profiler.metrics.totalActualDuration).toBe(0);
    expect(profiler.metrics.totalBaseDuration).toBe(0);
    expect(profiler.metrics.averageRenderTime).toBe(0);
    expect(profiler.metrics.renders).toHaveLength(0);
  });

  it('preserves component name after reset', () => {
    const profiler = createProfiler('TestComponent');

    profiler.onRenderCallback('TestComponent', 'mount', 10, 15, 100, 110);
    profiler.reset();

    expect(profiler.metrics.componentName).toBe('TestComponent');
  });
});

describe('profiler getSnapshot', () => {
  it('returns a copy of metrics', () => {
    const profiler = createProfiler('TestComponent');

    profiler.onRenderCallback('TestComponent', 'mount', 10, 15, 100, 110);

    const snapshot = profiler.getSnapshot();

    // Should have same values
    expect(snapshot.renderCount).toBe(1);
    expect(snapshot.componentName).toBe('TestComponent');

    // But should be a different object
    expect(snapshot).not.toBe(profiler.metrics);
    expect(snapshot.renders).not.toBe(profiler.metrics.renders);
  });

  it('snapshot is independent of future changes', () => {
    const profiler = createProfiler('TestComponent');

    profiler.onRenderCallback('TestComponent', 'mount', 10, 15, 100, 110);
    const snapshot = profiler.getSnapshot();

    // Add another render
    profiler.onRenderCallback('TestComponent', 'update', 5, 8, 200, 205);

    // Snapshot should still have old values
    expect(snapshot.renderCount).toBe(1);
    expect(snapshot.renders).toHaveLength(1);

    // Current metrics should have new values
    expect(profiler.metrics.renderCount).toBe(2);
    expect(profiler.metrics.renders).toHaveLength(2);
  });
});

describe('ProfilerWrapper', () => {
  it('renders children', () => {
    const profiler = createProfiler('TestComponent');

    render(
      <ProfilerWrapper id="test" profiler={profiler}>
        <div data-testid="child">Hello</div>
      </ProfilerWrapper>
    );

    expect(screen.getByTestId('child')).toBeDefined();
    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('tracks renders through profiler callback', () => {
    const profiler = createProfiler('TestComponent');

    render(
      <ProfilerWrapper id="test" profiler={profiler}>
        <div>Hello</div>
      </ProfilerWrapper>
    );

    // Should have recorded at least one render (mount)
    expect(profiler.metrics.renderCount).toBeGreaterThanOrEqual(1);
    expect(profiler.metrics.renders.length).toBeGreaterThanOrEqual(1);
    expect(profiler.metrics.renders[0].phase).toBe('mount');
  });
});

describe('withProfiler HOC', () => {
  it('wraps component and tracks renders', () => {
    const TestComponent = ({ text }: { text: string }) => <div>{text}</div>;
    const ProfiledComponent = withProfiler(TestComponent, 'TestComponent');

    render(<ProfiledComponent text="Hello" />);

    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('sets displayName', () => {
    const TestComponent = () => <div>Test</div>;
    const ProfiledComponent = withProfiler(TestComponent, 'TestComponent');

    expect(ProfiledComponent.displayName).toBe('Profiled(TestComponent)');
  });
});

describe('ProfilerProvider and useProfilerContext', () => {
  it('provides context to children', () => {
    let contextValue: ReturnType<typeof useProfilerContext> | null = null;

    const Consumer = () => {
      contextValue = useProfilerContext();
      return <div>Consumer</div>;
    };

    render(
      <ProfilerProvider>
        <Consumer />
      </ProfilerProvider>
    );

    expect(contextValue).not.toBeNull();
    expect(typeof contextValue!.recordRender).toBe('function');
    expect(typeof contextValue!.getMetrics).toBe('function');
    expect(typeof contextValue!.getAllMetrics).toBe('function');
    expect(typeof contextValue!.resetAll).toBe('function');
  });

  it('throws error when used outside provider', () => {
    const Consumer = () => {
      useProfilerContext();
      return <div>Consumer</div>;
    };

    expect(() => render(<Consumer />)).toThrow(
      'useProfilerContext must be used within a ProfilerProvider'
    );
  });

  it('records and retrieves metrics', () => {
    let contextValue: ReturnType<typeof useProfilerContext> | null = null;

    const Consumer = () => {
      contextValue = useProfilerContext();
      return <div>Consumer</div>;
    };

    render(
      <ProfilerProvider>
        <Consumer />
      </ProfilerProvider>
    );

    // Record a render event
    contextValue!.recordRender('TestComponent', {
      phase: 'mount',
      actualDuration: 10,
      baseDuration: 15,
      startTime: 100,
      commitTime: 110,
    });

    const metrics = contextValue!.getMetrics('TestComponent');

    expect(metrics).toBeDefined();
    expect(metrics!.renderCount).toBe(1);
    expect(metrics!.averageRenderTime).toBe(10);
  });

  it('resets all metrics', () => {
    let contextValue: ReturnType<typeof useProfilerContext> | null = null;

    const Consumer = () => {
      contextValue = useProfilerContext();
      return <div>Consumer</div>;
    };

    render(
      <ProfilerProvider>
        <Consumer />
      </ProfilerProvider>
    );

    // Record some events
    contextValue!.recordRender('ComponentA', {
      phase: 'mount',
      actualDuration: 10,
      baseDuration: 15,
      startTime: 100,
      commitTime: 110,
    });

    contextValue!.recordRender('ComponentB', {
      phase: 'mount',
      actualDuration: 5,
      baseDuration: 8,
      startTime: 200,
      commitTime: 205,
    });

    // Reset
    contextValue!.resetAll();

    expect(contextValue!.getMetrics('ComponentA')).toBeUndefined();
    expect(contextValue!.getMetrics('ComponentB')).toBeUndefined();
    expect(contextValue!.getAllMetrics().size).toBe(0);
  });
});

describe('useComponentProfiler', () => {
  it('provides onRender callback', () => {
    let hookResult: ReturnType<typeof useComponentProfiler> | null = null;

    const TestComponent = () => {
      hookResult = useComponentProfiler('TestComponent');
      return <div>Test</div>;
    };

    render(
      <ProfilerProvider>
        <TestComponent />
      </ProfilerProvider>
    );

    expect(hookResult).not.toBeNull();
    expect(typeof hookResult!.onRender).toBe('function');
  });

  it('returns undefined metrics initially', () => {
    let hookResult: ReturnType<typeof useComponentProfiler> | null = null;

    const TestComponent = () => {
      hookResult = useComponentProfiler('TestComponent');
      return <div>Test</div>;
    };

    render(
      <ProfilerProvider>
        <TestComponent />
      </ProfilerProvider>
    );

    expect(hookResult!.metrics).toBeUndefined();
  });
});
