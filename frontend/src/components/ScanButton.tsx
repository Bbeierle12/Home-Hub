import { useRef, useState } from "react";
import { ScanLine, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useOcr } from "../hooks/useOcr";
import type { OcrParser, OcrParseResult } from "../utils/ocr-parsers";

type ScanButtonProps<T> = {
  parser: OcrParser<T>;
  onResult: (fields: Partial<T>) => void;
  compact?: boolean;
};

export function ScanButton<T>({ parser, onResult, compact }: ScanButtonProps<T>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { recognize, isProcessing, error } = useOcr();
  const [result, setResult] = useState<OcrParseResult<T> | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const handleFile = async (file: File) => {
    try {
      const text = await recognize(file);
      const parsed = parser(text);
      setResult(parsed);
    } catch {
      // error state handled by useOcr
    }
  };

  const handleApply = () => {
    if (result) {
      onResult(result.fields);
      setResult(null);
      setShowRaw(false);
    }
  };

  const handleCancel = () => {
    setResult(null);
    setShowRaw(false);
  };

  return (
    <div className="relative inline-block">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void handleFile(file);
            e.target.value = "";
          }
        }}
      />

      <button
        type="button"
        disabled={isProcessing}
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 rounded-2xl border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-white/70 disabled:opacity-50"
      >
        {isProcessing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ScanLine className="size-3.5" />
        )}
        {!compact && (isProcessing ? "Scanning..." : "Scan")}
      </button>

      {error && !result && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 shadow-lg">
          {error}
        </div>
      )}

      {result && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-80 rounded-[20px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-3 text-sm font-semibold">Scanned Results</p>

          {/* Parsed fields */}
          <div className="mb-3 space-y-1.5">
            {Object.entries(result.fields).map(([key, value]) => {
              if (value === undefined || value === null || value === "") return null;
              const display = Array.isArray(value) ? value.join(", ") : String(value);
              return (
                <div key={key} className="flex gap-2 text-xs">
                  <span className="shrink-0 font-medium text-[color:var(--color-muted)]">
                    {key.replace(/_/g, " ")}:
                  </span>
                  <span className="truncate">{display}</span>
                </div>
              );
            })}
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="mb-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600">
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* Raw text toggle */}
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="mb-3 flex items-center gap-1 text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
          >
            {showRaw ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Raw text
          </button>
          {showRaw && (
            <pre className="mb-3 max-h-32 overflow-auto rounded-xl bg-white/80 p-2 text-[10px] leading-snug text-[color:var(--color-muted)]">
              {result.rawText}
            </pre>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 rounded-xl bg-[color:var(--color-ink)] px-3 py-2 text-xs font-semibold text-white"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-xs font-medium hover:bg-white/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
