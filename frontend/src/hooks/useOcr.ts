import { useState, useCallback } from "react";

type TesseractWorker = {
  recognize: (image: File | Blob | string) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
};

let workerPromise: Promise<TesseractWorker> | null = null;

function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(async ({ createWorker }) => {
      const worker = await createWorker("eng");
      return worker as unknown as TesseractWorker;
    });
  }
  return workerPromise;
}

export function useOcr() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognize = useCallback(async (image: File | Blob): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    try {
      const worker = await getWorker();
      const { data } = await worker.recognize(image);
      return data.text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OCR failed";
      setError(msg);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { recognize, isProcessing, error, reset };
}
