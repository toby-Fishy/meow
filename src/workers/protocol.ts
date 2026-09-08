/**
 * Message protocol shared by the main thread and the workers.
 *
 * Every tool on the site does its real work off the main thread: a 40 MB image
 * decode on the UI thread freezes the tab, and a frozen tab is both a bad
 * experience and a Core Web Vitals failure. Keeping one typed protocol means
 * each new tool only writes the task itself.
 */

export interface RunRequest<Payload = unknown> {
  kind: 'run';
  jobId: string;
  task: string;
  payload: Payload;
}

export interface CancelRequest {
  kind: 'cancel';
  jobId: string;
}

export type WorkerRequest<Payload = unknown> = RunRequest<Payload> | CancelRequest;

export interface ProgressResponse {
  kind: 'progress';
  jobId: string;
  /** Completion between 0 and 1. */
  ratio: number;
}

export interface DoneResponse<Result = unknown> {
  kind: 'done';
  jobId: string;
  result: Result;
}

export interface ErrorResponse {
  kind: 'error';
  jobId: string;
  message: string;
}

export type WorkerResponse<Result = unknown> =
  | ProgressResponse
  | DoneResponse<Result>
  | ErrorResponse;

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<WorkerResponse>;
  if (typeof candidate.jobId !== 'string') return false;
  return (
    candidate.kind === 'progress' || candidate.kind === 'done' || candidate.kind === 'error'
  );
}
