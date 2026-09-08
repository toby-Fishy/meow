import { useCallback, useEffect, useRef, useState } from 'react';
import { JobCancelledError, WorkerPipeline } from '../workers/pipeline.ts';
import type { InspectResult } from '../workers/inspect.worker.ts';

type Status =
  | { phase: 'idle' }
  | { phase: 'running'; ratio: number }
  | { phase: 'done'; result: InspectResult }
  | { phase: 'error'; message: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * Reference implementation of a tool front end: pick a file, watch real
 * progress, cancel mid-run, read the result. Each real tool swaps the task
 * name and the result rendering; the plumbing stays identical.
 */
export default function ToolShell() {
  const pipelineRef = useRef<WorkerPipeline | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<Status>({ phase: 'idle' });

  useEffect(() => {
    const worker = new Worker(new URL('../workers/inspect.worker.ts', import.meta.url), {
      type: 'module',
    });
    pipelineRef.current = new WorkerPipeline(worker);

    return () => {
      pipelineRef.current?.terminate();
      pipelineRef.current = null;
    };
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ phase: 'running', ratio: 0 });

    try {
      const result = await pipeline.run<InspectResult>('inspect', file, {
        signal: controller.signal,
        onProgress: (ratio) => setStatus({ phase: 'running', ratio }),
      });
      setStatus({ phase: 'done', result });
    } catch (error) {
      if (error instanceof JobCancelledError) {
        setStatus({ phase: 'idle' });
        return;
      }
      setStatus({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Something went wrong',
      });
    }
  }, []);

  return (
    <div className="shell">
      <label className="shell__drop">
        <input
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <span>Choose a file to inspect</span>
      </label>

      {status.phase === 'running' && (
        <div className="shell__progress">
          <progress value={status.ratio} max={1} />
          <button type="button" onClick={() => abortRef.current?.abort()}>
            Cancel
          </button>
        </div>
      )}

      {status.phase === 'done' && (
        <dl className="shell__result">
          <dt>Name</dt>
          <dd>{status.result.name}</dd>
          <dt>Size</dt>
          <dd>{formatBytes(status.result.size)}</dd>
          <dt>Type</dt>
          <dd>{status.result.type}</dd>
          <dt>SHA-256</dt>
          <dd className="shell__hash">{status.result.sha256}</dd>
        </dl>
      )}

      {status.phase === 'error' && <p role="alert">{status.message}</p>}
    </div>
  );
}
