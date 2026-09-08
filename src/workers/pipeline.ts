import {
  isWorkerResponse,
  type RunRequest,
  type WorkerRequest,
  type WorkerResponse,
} from './protocol.ts';

/** The slice of the `Worker` API the pipeline uses, so tests can supply a fake. */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  terminate(): void;
}

export class JobCancelledError extends Error {
  constructor(message = 'Job cancelled') {
    super(message);
    this.name = 'JobCancelledError';
  }
}

export interface RunOptions {
  /** Called with a value between 0 and 1 as the task reports progress. */
  onProgress?: (ratio: number) => void;
  /** Aborting asks the worker to stop and rejects the returned promise. */
  signal?: AbortSignal;
  /** Objects to hand to the worker by reference rather than copying. */
  transfer?: Transferable[];
}

interface PendingJob {
  resolve: (value: never) => void;
  reject: (reason: Error) => void;
  onProgress?: (ratio: number) => void;
  cleanup: () => void;
}

/**
 * Runs tasks on a worker, one promise per job.
 *
 * A single worker handles many jobs, identified by id, so tools do not pay
 * worker startup cost on every click.
 */
export class WorkerPipeline {
  readonly #worker: WorkerLike;
  readonly #pending = new Map<string, PendingJob>();
  #nextJobId = 0;
  #terminated = false;

  constructor(worker: WorkerLike) {
    this.#worker = worker;
    this.#worker.addEventListener('message', this.#handleMessage);
  }

  get pendingCount(): number {
    return this.#pending.size;
  }

  run<Result, Payload = unknown>(
    task: string,
    payload: Payload,
    options: RunOptions = {},
  ): Promise<Result> {
    if (this.#terminated) {
      return Promise.reject(new Error('Pipeline has been terminated'));
    }

    const jobId = `job-${this.#nextJobId++}`;
    const { signal } = options;

    if (signal?.aborted) {
      return Promise.reject(new JobCancelledError());
    }

    return new Promise<Result>((resolve, reject) => {
      const onAbort = () => {
        this.#settle(jobId, () => reject(new JobCancelledError()));
        this.#post({ kind: 'cancel', jobId });
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      this.#pending.set(jobId, {
        resolve: resolve as (value: never) => void,
        reject,
        onProgress: options.onProgress,
        cleanup: () => signal?.removeEventListener('abort', onAbort),
      });

      const request: RunRequest<Payload> = { kind: 'run', jobId, task, payload };
      this.#post(request, options.transfer);
    });
  }

  /** Rejects every in-flight job and shuts the worker down. */
  terminate(): void {
    if (this.#terminated) return;
    this.#terminated = true;

    for (const jobId of [...this.#pending.keys()]) {
      this.#settle(jobId, (job) => job.reject(new JobCancelledError('Pipeline terminated')));
    }

    this.#worker.removeEventListener('message', this.#handleMessage);
    this.#worker.terminate();
  }

  #post(request: WorkerRequest, transfer?: Transferable[]): void {
    if (transfer && transfer.length > 0) {
      this.#worker.postMessage(request, transfer);
    } else {
      this.#worker.postMessage(request);
    }
  }

  #handleMessage = (event: { data: unknown }): void => {
    if (!isWorkerResponse(event.data)) return;
    const response: WorkerResponse = event.data;

    if (response.kind === 'progress') {
      this.#pending.get(response.jobId)?.onProgress?.(response.ratio);
      return;
    }

    if (response.kind === 'done') {
      this.#settle(response.jobId, (job) => job.resolve(response.result as never));
      return;
    }

    this.#settle(response.jobId, (job) => job.reject(new Error(response.message)));
  };

  /** Removes a job before settling it, so a late message cannot settle it twice. */
  #settle(jobId: string, settle: (job: PendingJob) => void): void {
    const job = this.#pending.get(jobId);
    if (!job) return;
    this.#pending.delete(jobId);
    job.cleanup();
    settle(job);
  }
}
