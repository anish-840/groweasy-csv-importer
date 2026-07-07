'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CrmRecord,
  ExtractionSource,
  ExtractionSummary,
  SkippedRecord,
} from '@groweasy/shared';
import { streamExtract } from '@/lib/api';
import { parseCsvFile, type ClientParsedCsv } from '@/lib/csv';
import { AlertTriangle } from './icons';
import { Stepper, type StepId } from './Stepper';
import { UploadStep } from './steps/UploadStep';
import { PreviewStep } from './steps/PreviewStep';
import { ResultStep } from './steps/ResultStep';

export interface ExtractionState {
  status: 'idle' | 'streaming' | 'done' | 'error';
  records: CrmRecord[];
  skipped: SkippedRecord[];
  totalRows: number;
  totalBatches: number;
  processedRows: number;
  completedBatches: number;
  source: ExtractionSource | null;
  model: string | null;
  usedFallback: boolean;
  warnings: string[];
  summary: ExtractionSummary | null;
  error: string | null;
}

const initialExtraction: ExtractionState = {
  status: 'idle',
  records: [],
  skipped: [],
  totalRows: 0,
  totalBatches: 0,
  processedRows: 0,
  completedBatches: 0,
  source: null,
  model: null,
  usedFallback: false,
  warnings: [],
  summary: null,
  error: null,
};

export function CsvImporter() {
  const [step, setStep] = useState<StepId>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ClientParsedCsv | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionState>(initialExtraction);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleFile = useCallback(async (f: File) => {
    setUploadError(null);
    try {
      const result = await parseCsvFile(f);
      if (result.rowCount === 0) {
        setUploadError('No data rows found in that CSV (only a header, or all rows are empty).');
        return;
      }
      setFile(f);
      setParsed(result);
      setStep('preview');
    } catch {
      setUploadError('Could not parse that file as CSV. Please check the format.');
    }
  }, []);

  const runExtraction = useCallback((f: File) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setExtraction({ ...initialExtraction, status: 'streaming' });

    streamExtract(f, {
      signal: controller.signal,
      onEvent: (event) => {
        setExtraction((prev) => {
          switch (event.type) {
            case 'start':
              return {
                ...prev,
                status: 'streaming',
                totalRows: event.totalRows,
                totalBatches: event.totalBatches,
                source: event.source,
                model: event.model,
                usedFallback: event.source === 'heuristic',
              };
            case 'batch':
              return {
                ...prev,
                records: [...prev.records, ...event.records],
                skipped: [...prev.skipped, ...event.skipped],
                processedRows: event.processedRows,
                completedBatches: prev.completedBatches + 1,
                usedFallback: prev.usedFallback || (prev.source !== 'heuristic' && event.source === 'heuristic'),
              };
            case 'warning':
              return { ...prev, warnings: [...prev.warnings, event.message], usedFallback: true };
            case 'done':
              return {
                ...prev,
                status: 'done',
                summary: event.summary,
                usedFallback: event.summary.usedFallback,
                processedRows: event.summary.totalRows,
              };
            case 'error':
              return { ...prev, status: 'error', error: event.message };
            default:
              return prev;
          }
        });
      },
    }).catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setExtraction((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Extraction failed. Is the API reachable?',
      }));
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!file) return;
    setStep('result');
    runExtraction(file);
  }, [file, runExtraction]);

  const handleRetry = useCallback(() => {
    if (file) runExtraction(file);
  }, [file, runExtraction]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setFile(null);
    setParsed(null);
    setExtraction(initialExtraction);
    setUploadError(null);
    setStep('upload');
  }, []);

  const handleBack = useCallback(() => {
    setParsed(null);
    setFile(null);
    setStep('upload');
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <Stepper current={step} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-soft backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60 sm:p-6">
        {step === 'upload' && (
          <>
            {uploadError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">
                <AlertTriangle className="shrink-0 text-base" />
                {uploadError}
              </div>
            )}
            <UploadStep onFile={handleFile} />
          </>
        )}

        {step === 'preview' && file && parsed && (
          <PreviewStep file={file} parsed={parsed} onConfirm={handleConfirm} onBack={handleBack} />
        )}

        {step === 'result' && file && (
          <ResultStep
            state={extraction}
            fileName={file.name}
            onReset={handleReset}
            onRetry={handleRetry}
          />
        )}
      </div>
    </div>
  );
}
