/// <reference lib="webworker" />
import { serveTasks, type TaskContext } from './serve.ts';

export interface InspectResult {
  name: string;
  size: number;
  type: string;
  sha256: string;
}

/**
 * Reads a file in chunks so progress is real rather than a spinner, then
 * hashes it. This is the reference implementation of a pipeline task: the
 * file crosses to the worker by reference, the handler reports progress, and
 * it checks `signal` between chunks so cancelling actually stops the work.
 */
async function inspect(file: File, { reportProgress, signal }: TaskContext): Promise<InspectResult> {
  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];
  let read = 0;

  try {
    for (;;) {
      if (signal.aborted) throw new Error('Cancelled');

      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      read += value.byteLength;
      if (file.size > 0) reportProgress(read / file.size);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(read);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const digest = await crypto.subtle.digest('SHA-256', bytes);
  reportProgress(1);

  return {
    name: file.name,
    size: file.size,
    type: file.type || 'unknown',
    sha256: [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}

serveTasks(self as unknown as DedicatedWorkerGlobalScope, { inspect });
