import { createWorker, type Worker } from "tesseract.js";

export interface UpiScreenshotOcrResult {
  amount: number | null;
  utr: string | null;
  rawText: string;
  confidence: number;
  failed?: boolean;
}

const ocrResultCache = new Map<string, UpiScreenshotOcrResult>();
let workerPromise: Promise<Worker> | null = null;
let scanQueue: Promise<unknown> = Promise.resolve();

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng").catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

function parseNumericAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0 || num > 500000) return null;
  return Math.round(num);
}

export function extractAmountFromOcrText(text: string): number | null {
  if (!text) return null;
  const currencyMatches = Array.from(
    text.matchAll(/(?:₹|Rs\.?|INR)\s*[:\-]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi)
  );
  for (const m of currencyMatches) {
    const val = parseNumericAmount(m[1] || "");
    if (val !== null) return val;
  }

  const keywordMatches = Array.from(
    text.matchAll(
      /(?:Paid(?:\s+to)?|Amount|Total|Successfully\s+paid|Payment\s+of|Sent)\s*[:\-₹RsINR\s]{0,6}([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi
    )
  );
  for (const m of keywordMatches) {
    const val = parseNumericAmount(m[1] || "");
    if (val !== null) return val;
  }

  return null;
}

export function extractUtrFromOcrText(text: string): string | null {
  if (!text) return null;
  const normalized = text.replace(/\r/g, "\n");
  const explicitMatch = normalized.match(
    /(?:UTR(?:\s*No\.?)?|UPI\s*(?:Ref(?:erence)?|Transaction|Txn)\s*(?:ID|No\.?)?|Ref(?:erence)?\s*(?:No\.?|ID)|Transaction\s*ID|Txn\s*ID)\s*[:\-#\s\n]{1,6}([A-Z0-9]{10,22})/i
  );
  if (explicitMatch?.[1]) {
    const candidate = explicitMatch[1].trim().toUpperCase();
    if (/\d{6,}/.test(candidate)) {
      return candidate;
    }
  }

  const rrnMatches = Array.from(normalized.matchAll(/\b([1-9][0-9]{11})\b/g));
  for (const m of rrnMatches) {
    const rrn = m[1];
    if (rrn && !/^91[6-9][0-9]{9}$/.test(rrn)) {
      return rrn;
    }
  }

  return null;
}

export async function scanUpiScreenshot(imageSrc: string): Promise<UpiScreenshotOcrResult> {
  const src = String(imageSrc || "").trim();
  if (!src) {
    return { amount: null, utr: null, rawText: "", confidence: 0, failed: true };
  }
  const cacheKey = `${src.slice(0, 160)}_${src.length}`;
  const cached = ocrResultCache.get(cacheKey);
  if (cached) return cached;

  const task = scanQueue.then(async (): Promise<UpiScreenshotOcrResult> => {
    const again = ocrResultCache.get(cacheKey);
    if (again) return again;
    try {
      const worker = await getOcrWorker();
      const res = await worker.recognize(src);
      const rawText = String(res?.data?.text || "").trim();
      const confidence = Math.round(Number(res?.data?.confidence || 0));
      const parsed: UpiScreenshotOcrResult = {
        amount: extractAmountFromOcrText(rawText),
        utr: extractUtrFromOcrText(rawText),
        rawText,
        confidence,
      };
      ocrResultCache.set(cacheKey, parsed);
      return parsed;
    } catch {
      return { amount: null, utr: null, rawText: "", confidence: 0, failed: true };
    }
  });

  scanQueue = task.catch(() => undefined);
  return task;
}
