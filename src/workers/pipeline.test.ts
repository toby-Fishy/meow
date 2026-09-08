import { describe, expect, it, vi } from 'vitest';
import { JobCancelledError, WorkerPipeline, type WorkerLike } from './pipeline.ts';
import { serveTasks, type TaskHandler, type WorkerScopeLike } from './serve.ts';

type Listener = (event: { data: unknown }) => void;

/**
 * A worker and its scope wired to each other in one thread, so the client and
 * the server halves of the protocol are tested against each other rather than
 * against a hand-written stub of either.
 */
function createChannel(handlers: Record<string, TaskHandler<never, unknown>>) {
  const mainListeners = new Set<Listener>();
  const scopeListeners = new Set<Listener>();
  let terminated = false;

  const deliver = (listeners: Set<Listener>, data: unknown) => {
    if (terminated) return;
    queueMicrotask(() => {
      for (const listener of listeners) listener({ data });
    });
  };

  const scope: WorkerScopeLike = {
    addEventListener: (_type, listener) => void scopeListeners.add(listener),
    postMessage: (message) => deliver(mainListeners, message),
  };

  const worker: WorkerLike = {
    postMessage: (message) => deliver(scopeListeners, message),
    addEventListener: (_type, listener) => void mainListeners.add(listener),
    removeEventListener: (_type, listener) => void mainListeners.delete(listener),
    terminate: () => {
      terminated = true;
    },
  };

  serveTasks(scope, handlers);

  return { pipeline: new WorkerPipeline(worker), isTerminated: () => terminated };
}

describe('WorkerPipeline', () => {
  it('resolves with the handler result', async () => {
    const { pipeline } = createChannel({
      double: ((value: number) => value * 2),
    });

    await expect(pipeline.run<number>('double', 21)).resolves.toBe(42);
  });

  it('awaits asynchronous handlers', async () => {
    const { pipeline } = createChannel({
      slow: (async () => {
        await Promise.resolve();
        return 'done';
      }),
    });

    await expect(pipeline.run<string>('slow', null)).resolves.toBe('done');
  });

  it('reports progress before resolving', async () => {
    const onProgress = vi.fn();
    const { pipeline } = createChannel({
      steps: ((_payload: unknown, context) => {
        context.reportProgress(0.5);
        context.reportProgress(1);
        return 'finished';
      }),
    });

    await expect(pipeline.run<string>('steps', null, { onProgress })).resolves.toBe('finished');
    expect(onProgress.mock.calls).toEqual([[0.5], [1]]);
  });

  it('clamps out-of-range progress values', async () => {
    const onProgress = vi.fn();
    const { pipeline } = createChannel({
      wild: ((_payload: unknown, context) => {
        context.reportProgress(-3);
        context.reportProgress(9);
        return null;
      }),
    });

    await pipeline.run('wild', null, { onProgress });
    expect(onProgress.mock.calls).toEqual([[0], [1]]);
  });

  it('rejects when the handler throws', async () => {
    const { pipeline } = createChannel({
      boom: (() => {
        throw new Error('handler exploded');
      }),
    });

    await expect(pipeline.run('boom', null)).rejects.toThrow('handler exploded');
  });

  it('rejects an unknown task rather than hanging', async () => {
    const { pipeline } = createChannel({});
    await expect(pipeline.run('missing', null)).rejects.toThrow('Unknown task "missing"');
  });

  it('rejects immediately when given an already-aborted signal', async () => {
    const { pipeline } = createChannel({
      any: (() => 'value'),
    });

    await expect(
      pipeline.run('any', null, { signal: AbortSignal.abort() }),
    ).rejects.toBeInstanceOf(JobCancelledError);
  });

  it('rejects with JobCancelledError when aborted mid-flight', async () => {
    const controller = new AbortController();
    const { pipeline } = createChannel({
      forever: (() => new Promise(() => {})),
    });

    const job = pipeline.run('forever', null, { signal: controller.signal });
    controller.abort();

    await expect(job).rejects.toBeInstanceOf(JobCancelledError);
  });

  it('ignores a result that arrives after cancellation', async () => {
    const controller = new AbortController();
    let finish: ((value: string) => void) | undefined;
    const { pipeline } = createChannel({
      pending: (() =>
        new Promise<string>((resolve) => {
          finish = resolve;
        })),
    });

    const job = pipeline.run('pending', null, { signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(job).rejects.toBeInstanceOf(JobCancelledError);

    finish?.('late result');
    await Promise.resolve();
    expect(pipeline.pendingCount).toBe(0);
  });

  it('keeps concurrent jobs separate', async () => {
    const { pipeline } = createChannel({
      echo: ((value: string) => value),
      shout: ((value: string) => value.toUpperCase()),
    });

    await expect(
      Promise.all([pipeline.run<string>('echo', 'a'), pipeline.run<string>('shout', 'b')]),
    ).resolves.toEqual(['a', 'B']);
  });

  it('clears its pending map once jobs settle', async () => {
    const { pipeline } = createChannel({
      echo: ((value: string) => value),
    });

    const job = pipeline.run<string>('echo', 'x');
    expect(pipeline.pendingCount).toBe(1);
    await job;
    expect(pipeline.pendingCount).toBe(0);
  });

  it('rejects in-flight jobs when terminated', async () => {
    const { pipeline, isTerminated } = createChannel({
      forever: (() => new Promise(() => {})),
    });

    const job = pipeline.run('forever', null);
    pipeline.terminate();

    await expect(job).rejects.toThrow('Pipeline terminated');
    expect(isTerminated()).toBe(true);
  });

  it('refuses new work after termination', async () => {
    const { pipeline } = createChannel({});
    pipeline.terminate();
    await expect(pipeline.run('anything', null)).rejects.toThrow('terminated');
  });
});
