import type { WorkerRequest, WorkerResponse } from './protocol.ts';

export interface TaskContext {
  /** Report completion between 0 and 1. Values are clamped. */
  reportProgress(ratio: number): void;
  /** Aborts when the main thread cancels the job. */
  signal: AbortSignal;
}

export type TaskHandler<Payload = never, Result = unknown> = (
  payload: Payload,
  context: TaskContext,
) => Result | Promise<Result>;

/** The slice of `DedicatedWorkerGlobalScope` the helper needs. */
export interface WorkerScopeLike {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

/**
 * Wires a set of task handlers into a worker scope.
 *
 * Handlers stay plain async functions: the helper owns job bookkeeping,
 * progress reporting, cancellation and error serialisation, so a new tool is
 * only the transform itself.
 */
export function serveTasks(
  scope: WorkerScopeLike,
  /**
   * Handlers are contravariant in their payload, so a map typed with `never`
   * accepts a handler of any concrete payload type without widening to `any`.
   * The payload itself is only checked at the boundary, below.
   */
  handlers: Record<string, TaskHandler<never, unknown>>,
): void {
  const inFlight = new Map<string, AbortController>();

  const reply = (response: WorkerResponse, transfer?: Transferable[]) => {
    if (transfer && transfer.length > 0) {
      scope.postMessage(response, transfer);
    } else {
      scope.postMessage(response);
    }
  };

  scope.addEventListener('message', (event) => {
    const request = event.data as WorkerRequest;
    if (typeof request !== 'object' || request === null) return;

    if (request.kind === 'cancel') {
      inFlight.get(request.jobId)?.abort();
      inFlight.delete(request.jobId);
      return;
    }

    if (request.kind !== 'run') return;

    const { jobId, task, payload } = request;
    const handler = handlers[task];

    if (!handler) {
      reply({ kind: 'error', jobId, message: `Unknown task "${task}"` });
      return;
    }

    const controller = new AbortController();
    inFlight.set(jobId, controller);

    const context: TaskContext = {
      reportProgress(ratio) {
        if (controller.signal.aborted) return;
        reply({ kind: 'progress', jobId, ratio: Math.min(1, Math.max(0, ratio)) });
      },
      signal: controller.signal,
    };

    void Promise.resolve()
      .then(() => handler(payload as never, context))
      .then(
        (result) => {
          if (controller.signal.aborted) return;
          reply({ kind: 'done', jobId, result });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          reply({
            kind: 'error',
            jobId,
            message: error instanceof Error ? error.message : String(error),
          });
        },
      )
      .finally(() => {
        inFlight.delete(jobId);
      });
  });
}
