import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clampQuality,
  formatBytes,
  isLossy,
  labelFor,
  percentChange,
  resolveFormat,
  type OutputFormat,
  type TargetFormat,
} from '../lib/image.ts';
import type { TransformResult } from '../workers/image.worker.ts';
import { JobCancelledError, WorkerPipeline } from '../workers/pipeline.ts';
import type { ToolOperation } from '../tools/registry.ts';

interface Props {
  operation: ToolOperation;
  accept: string;
}

interface Source {
  id: string;
  file: File;
}

type Outcome =
  | { state: 'waiting' }
  | { state: 'working'; progress: number }
  | { state: 'done'; result: TransformResult; url: string }
  | { state: 'failed'; message: string };

interface Settings {
  format: TargetFormat;
  quality: number;
  width: string;
  height: string;
  scale: string;
  mode: 'pixels' | 'percent';
}

const DEFAULTS: Settings = {
  format: 'original',
  quality: 0.8,
  width: '',
  height: '',
  scale: '50',
  mode: 'pixels',
};

/** Falls back to a sensible list if the browser rejects the capability probe. */
const FALLBACK_FORMATS: OutputFormat[] = ['image/jpeg', 'image/png', 'image/webp'];

function parsePositive(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default function ImageTool({ operation, accept }: Props) {
  const pipelineRef = useRef<WorkerPipeline | null>(null);
  const urlsRef = useRef<string[]>([]);

  const [sources, setSources] = useState<Source[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [settings, setSettings] = useState<Settings>(() =>
    operation === 'convert' ? { ...DEFAULTS, format: 'image/webp' } : DEFAULTS,
  );
  const [formats, setFormats] = useState<OutputFormat[]>(FALLBACK_FORMATS);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/image.worker.ts', import.meta.url), {
      type: 'module',
    });
    const pipeline = new WorkerPipeline(worker);
    pipelineRef.current = pipeline;

    // AVIF is widely readable but rarely writable, so ask the browser rather
    // than offering an option that silently produces a PNG.
    pipeline
      .run<OutputFormat[]>('supportedFormats', null)
      .then((supported) => {
        if (supported.length > 0) setFormats(supported);
      })
      .catch(() => {
        /* Keep the fallback list. */
      });

    return () => {
      pipeline.terminate();
      pipelineRef.current = null;
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
      urlsRef.current = [];
    };
  }, []);

  const resizeIntent = useMemo(() => {
    if (operation !== 'resize') return undefined;
    if (settings.mode === 'percent') {
      const percent = parsePositive(settings.scale);
      return percent ? { scale: percent / 100 } : undefined;
    }
    const width = parsePositive(settings.width);
    const height = parsePositive(settings.height);
    return width || height ? { width, height } : undefined;
  }, [operation, settings.mode, settings.scale, settings.width, settings.height]);

  // Resize always keeps the input format; the other two let the visitor choose.
  const target: TargetFormat = operation === 'resize' ? 'original' : settings.format;
  const quality = settings.quality;

  const formatOptions = useMemo(() => {
    const options = formats.map((format) => ({ value: format as TargetFormat, label: labelFor(format) }));
    return operation === 'compress'
      ? [{ value: 'original' as TargetFormat, label: 'Same' }, ...options]
      : options;
  }, [formats, operation]);

  /**
   * PNG ignores the quality argument entirely, so showing an active slider for
   * it would be a control that does nothing. Keeping the input's format can
   * mean a mix of types, so the slider stays if it affects any of them.
   */
  const qualityApplies =
    target === 'original'
      ? sources.some((source) => isLossy(resolveFormat('original', source.file.type)))
      : isLossy(target);

  const losslessCount =
    target === 'original'
      ? sources.filter((source) => !isLossy(resolveFormat('original', source.file.type))).length
      : 0;

  // Re-runs whenever the inputs or the settings change, so the preview always
  // reflects the controls without the visitor pressing a button.
  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline || sources.length === 0) return;

    const controller = new AbortController();
    let stale = false;

    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];

    setOutcomes(Object.fromEntries(sources.map((s) => [s.id, { state: 'waiting' } as Outcome])));

    void (async () => {
      for (const source of sources) {
        if (stale) return;

        try {
          const result = await pipeline.run<TransformResult>(
            'transform',
            { file: source.file, target, quality, resize: resizeIntent },
            {
              signal: controller.signal,
              onProgress: (progress) =>
                setOutcomes((current) => ({ ...current, [source.id]: { state: 'working', progress } })),
            },
          );
          if (stale) return;

          const url = URL.createObjectURL(result.blob);
          urlsRef.current.push(url);
          setOutcomes((current) => ({ ...current, [source.id]: { state: 'done', result, url } }));
        } catch (error) {
          if (stale || error instanceof JobCancelledError) return;
          setOutcomes((current) => ({
            ...current,
            [source.id]: {
              state: 'failed',
              message: error instanceof Error ? error.message : 'Could not read this image',
            },
          }));
        }
      }
    })();

    return () => {
      stale = true;
      controller.abort();
    };
  }, [sources, target, quality, resizeIntent]);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const images = [...list].filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;

    setSources((current) => [
      ...current,
      ...images.map((file, index) => ({ id: `${Date.now()}-${index}-${file.name}`, file })),
    ]);
  }, []);

  const download = useCallback((url: string, name: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
  }, []);

  const finished = sources
    .map((source) => ({ source, outcome: outcomes[source.id] }))
    .filter(
      (entry): entry is { source: Source; outcome: Extract<Outcome, { state: 'done' }> } =>
        entry.outcome?.state === 'done',
    );

  const totals = finished.reduce(
    (accumulator, { outcome }) => ({
      before: accumulator.before + outcome.result.originalSize,
      after: accumulator.after + outcome.result.size,
    }),
    { before: 0, after: 0 },
  );

  return (
    <div className="tool">
      <div
        className={`dropzone${dragging ? ' dropzone--active' : ''}${
          sources.length > 0 ? ' dropzone--compact' : ''
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <label className="dropzone__label">
          <input
            type="file"
            accept={accept}
            multiple
            className="dropzone__input"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <span className="dropzone__title">Drop images here</span>
          <span className="dropzone__hint">or click to choose — they stay on your device</span>
        </label>
      </div>

      {sources.length > 0 && (
        <>
          <div className="controls">
            {operation !== 'resize' && (
              <div className="control">
                <span className="control__label">
                  {operation === 'compress' ? 'Save as' : 'Convert to'}
                </span>
                <div className="segmented" role="group" aria-label="Output format">
                  {formatOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={`segmented__option${settings.format === value ? ' is-selected' : ''}`}
                      aria-pressed={settings.format === value}
                      onClick={() => setSettings((s) => ({ ...s, format: value }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {operation === 'resize' && (
              <>
                <div className="control">
                  <span className="control__label">Resize by</span>
                  <div className="segmented" role="group">
                    {(['pixels', 'percent'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`segmented__option${settings.mode === mode ? ' is-selected' : ''}`}
                        aria-pressed={settings.mode === mode}
                        onClick={() => setSettings((s) => ({ ...s, mode }))}
                      >
                        {mode === 'pixels' ? 'Pixels' : 'Percent'}
                      </button>
                    ))}
                  </div>
                </div>

                {settings.mode === 'pixels' ? (
                  <div className="control control--pair">
                    <span className="control__label">Dimensions</span>
                    <div className="pair">
                      <input
                        type="number"
                        min={1}
                        placeholder="Width"
                        aria-label="Width in pixels"
                        value={settings.width}
                        onChange={(event) =>
                          setSettings((s) => ({ ...s, width: event.target.value }))
                        }
                      />
                      <span className="pair__times" aria-hidden="true">
                        ×
                      </span>
                      <input
                        type="number"
                        min={1}
                        placeholder="Height"
                        aria-label="Height in pixels"
                        value={settings.height}
                        onChange={(event) =>
                          setSettings((s) => ({ ...s, height: event.target.value }))
                        }
                      />
                    </div>
                    <span className="control__note">
                      Fill in one and the other follows the original proportions.
                    </span>
                  </div>
                ) : (
                  <div className="control">
                    <label htmlFor="scale">
                      Scale <span className="control__value">{settings.scale}%</span>
                    </label>
                    <input
                      id="scale"
                      type="range"
                      min={1}
                      max={200}
                      value={settings.scale}
                      onChange={(event) =>
                        setSettings((s) => ({ ...s, scale: event.target.value }))
                      }
                    />
                  </div>
                )}
              </>
            )}

            {qualityApplies && (
              <div className="control">
                <label htmlFor="quality">
                  Quality <span className="control__value">{Math.round(quality * 100)}</span>
                </label>
                <input
                  id="quality"
                  type="range"
                  min={1}
                  max={100}
                  value={Math.round(quality * 100)}
                  onChange={(event) =>
                    setSettings((s) => ({
                      ...s,
                      quality: clampQuality(Number(event.target.value) / 100),
                    }))
                  }
                />
              </div>
            )}

            {losslessCount > 0 && operation === 'compress' && (
              <p className="control__note control__note--wide">
                {losslessCount === sources.length ? 'PNG is lossless' : 'PNG images are lossless'},
                so quality does not apply. Save as WebP for a much smaller file.
              </p>
            )}
          </div>

          <ul className="results">
            {sources.map(({ id, file }) => {
              const outcome = outcomes[id] ?? { state: 'waiting' as const };
              return (
                <li key={id} className="result">
                  <div className="result__thumb">
                    {outcome.state === 'done' && <img src={outcome.url} alt="" loading="lazy" />}
                  </div>

                  <div className="result__body">
                    <p className="result__name" title={file.name}>
                      {file.name}
                    </p>

                    {outcome.state === 'done' ? (
                      <p className="result__meta">
                        <span>{formatBytes(outcome.result.originalSize)}</span>
                        <span className="result__arrow" aria-hidden="true">
                          →
                        </span>
                        <span className="result__new">{formatBytes(outcome.result.size)}</span>
                        <span className="result__dims">
                          {outcome.result.width} × {outcome.result.height}
                        </span>
                      </p>
                    ) : outcome.state === 'failed' ? (
                      <p className="result__meta result__meta--error">{outcome.message}</p>
                    ) : (
                      <p className="result__meta">
                        <progress
                          value={outcome.state === 'working' ? outcome.progress : 0}
                          max={1}
                        />
                      </p>
                    )}
                  </div>

                  {outcome.state === 'done' && (
                    <>
                      <Saving
                        change={percentChange(outcome.result.originalSize, outcome.result.size)}
                      />
                      <button
                        type="button"
                        className="button"
                        onClick={() => download(outcome.url, outcome.result.name)}
                      >
                        Download
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setSources((current) => current.filter((s) => s.id !== id))}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>

          {finished.length > 0 && (
            <div className="summary">
              {/* With one image the row above already says this. */}
              {finished.length > 1 ? (
                <p className="summary__text">
                  {formatBytes(totals.before)} → <strong>{formatBytes(totals.after)}</strong>
                  <Saving change={percentChange(totals.before, totals.after)} />
                </p>
              ) : (
                <p className="summary__text summary__text--note">
                  Saved to your device only when you download.
                </p>
              )}

              <div className="summary__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setSources([])}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    // Browsers throttle rapid programmatic downloads, so space them out.
                    finished.forEach(({ outcome }, index) => {
                      window.setTimeout(
                        () => download(outcome.url, outcome.result.name),
                        index * 250,
                      );
                    });
                  }}
                >
                  Download {finished.length === 1 ? 'image' : `all ${finished.length}`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Saving({ change }: { change: number }) {
  const grew = change < 0;
  return (
    <span className={`saving${grew ? ' saving--grew' : ''}`}>
      {grew ? `+${Math.abs(change)}%` : `−${change}%`}
    </span>
  );
}
