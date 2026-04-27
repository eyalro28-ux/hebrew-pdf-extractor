'use client';

import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { extractTextFromPdf, renderPdfPagesToImages, isLikelyGarbledHebrew } from '@/lib/extractPdf';

type State = 'idle' | 'loading' | 'vision' | 'done' | 'error';

export default function Home() {
  const [text, setText] = useState('');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const generationRef = useRef(0);
  const currentFileRef = useRef<File | null>(null);

  async function runVision(file: File, generation: number) {
    setState('vision');
    try {
      const pages = await renderPdfPagesToImages(file);
      if (generation !== generationRef.current) return;

      // Send one page at a time to stay under Vercel's 4.5MB body limit
      const pageTexts: string[] = [];
      for (const page of pages) {
        if (generation !== generationRef.current) return;
        const res = await fetch('/api/extract-vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pages: [page] }),
        });
        if (!res.ok) {
          let detail = `status ${res.status}`;
          try {
            const body = await res.json() as { error?: string };
            if (body.error) detail = body.error;
          } catch { /* non-JSON response */ }
          throw new Error(detail);
        }
        const { text: pageText } = await res.json() as { text: string };
        pageTexts.push(pageText);
      }

      if (generation !== generationRef.current) return;
      const visionText = pageTexts.join('\n\n');
      if (!visionText.trim()) {
        setError('No text could be extracted from this PDF.');
        setState('error');
        return;
      }
      setText(visionText);
      setState('done');
    } catch (err) {
      if (generation !== generationRef.current) return;
      const detail = err instanceof Error ? err.message : String(err);
      setError(`AI Vision failed: ${detail}`);
      setState('error');
    }
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file.');
      setState('error');
      return;
    }
    const generation = ++generationRef.current;
    currentFileRef.current = file;
    setState('loading');
    setError('');
    setText('');
    try {
      const extracted = await extractTextFromPdf(file);
      if (generation !== generationRef.current) return;

      if (!extracted.trim() || isLikelyGarbledHebrew(extracted)) {
        await runVision(file, generation);
        return;
      }

      setText(extracted);
      setState('done');
    } catch {
      if (generation !== generationRef.current) return;
      setError('Failed to extract text. The PDF may be password-protected or corrupted.');
      setState('error');
    }
  }

  async function handleRetryWithVision() {
    const file = currentFileRef.current;
    if (!file) return;
    const generation = ++generationRef.current;
    setText('');
    setError('');
    await runVision(file, generation);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently no-op
    }
  }

  function handleDownload() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Hebrew PDF Extractor</h1>

      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 transition-colors mb-6"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <p className="text-gray-500">Drag & drop a PDF here, or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {state === 'loading' && (
        <p className="text-gray-500 mb-4">Extracting text...</p>
      )}

      {state === 'vision' && (
        <p className="text-gray-500 mb-4">Running AI Vision extraction...</p>
      )}

      {state === 'error' && (
        <p className="text-red-600 mb-4">{error}</p>
      )}

      {state === 'done' && (
        <>
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Download .txt
            </button>
            <button
              onClick={handleRetryWithVision}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Text looks wrong? Try AI
            </button>
          </div>
          <textarea
            dir="rtl"
            lang="he"
            value={text}
            readOnly
            className="w-full border border-gray-300 rounded p-4 font-sans text-base leading-relaxed"
            style={{ height: '80vh', resize: 'vertical' }}
          />
        </>
      )}
    </main>
  );
}
