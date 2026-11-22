import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * pdf.js is large, so it is loaded lazily the first time a worksheet PDF is
 * opened. The worker is bundled by Vite as an asset (`?url`) so the app keeps
 * working offline and without a CDN.
 */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export async function loadPdfLibrary(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      // Vite bundles the worker as its own module. Using `workerPort` avoids the
      // "fake worker" fallback that stalls page rendering in dev and in builds.
      const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?worker");
      pdfjs.GlobalWorkerOptions.workerPort = new workerModule.default();
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export interface OpenedPdf {
  doc: PDFDocumentProxy;
  destroy: () => Promise<void>;
}

export async function openPdf(blob: Blob): Promise<OpenedPdf> {
  const pdfjs = await loadPdfLibrary();
  const data = new Uint8Array(await blob.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  return { doc, destroy: () => task.destroy() };
}

/* --------------------------------- memo ---------------------------------- */

export type MemoTool = "pen" | "highlighter" | "eraser";

export interface MemoPoint {
  /** 0..1 relative to the page width. */
  x: number;
  /** 0..1 relative to the page height. */
  y: number;
}

export interface MemoStroke {
  tool: MemoTool;
  color: string;
  /** Line width as a fraction of the page width. */
  width: number;
  points: MemoPoint[];
}

export const TOOL_WIDTHS: Record<MemoTool, number> = {
  pen: 0.0035,
  highlighter: 0.022,
  eraser: 0.03,
};

/** Draws every stroke onto a canvas sized the same as the rendered page. */
export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: MemoStroke[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    const lineWidth = Math.max(1, stroke.width * width);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else if (stroke.tool === "highlighter") {
      ctx.globalAlpha = 0.32;
    }

    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
      for (let index = 1; index < stroke.points.length; index += 1) {
        const point = stroke.points[index];
        ctx.lineTo(point.x * width, point.y * height);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function readMemo(storeKey: string): Record<string, MemoStroke[]> {
  if (!storeKey) return {};
  try {
    const raw = window.localStorage.getItem(`aic:memo:${storeKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, MemoStroke[]> = {};
    for (const [page, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      out[page] = value.filter((stroke): stroke is MemoStroke => {
        if (!stroke || typeof stroke !== "object") return false;
        const item = stroke as MemoStroke;
        return (
          Array.isArray(item.points) &&
          typeof item.width === "number" &&
          typeof item.color === "string" &&
          (item.tool === "pen" || item.tool === "highlighter" || item.tool === "eraser")
        );
      });
    }
    return out;
  } catch {
    return {};
  }
}

export function writeMemo(storeKey: string, memo: Record<string, MemoStroke[]>): void {
  if (!storeKey) return;
  try {
    window.localStorage.setItem(`aic:memo:${storeKey}`, JSON.stringify(memo));
  } catch {
    /* storage full or disabled — the memo still works for this session */
  }
}

export function memoHasInk(memo: Record<string, MemoStroke[]>): boolean {
  return Object.values(memo).some((strokes) => strokes.some((stroke) => stroke.tool !== "eraser"));
}
