import { useCallback, useEffect, useRef, useState } from "react";
import {
  TOOL_WIDTHS,
  memoHasInk,
  openPdf,
  paintStrokes,
  readMemo,
  writeMemo,
  type MemoStroke,
  type MemoTool,
} from "../lib/pdf";
import { downloadBlob } from "../lib/fileTransfer";
import { Spinner, cx } from "./ui";
import { IconCheck, IconDownload, IconX } from "./Icons";

const COLORS = ["#111827", "#dc2626", "#2563eb", "#059669"];
const TOOL_LABEL: Record<MemoTool, string> = { pen: "펜", highlighter: "형광펜", eraser: "지우개" };
const MAX_PAGES = 80;

interface RenderedPage {
  index: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function MemoPage({
  page,
  strokes,
  tool,
  color,
  onCommit,
}: {
  page: RenderedPage;
  strokes: MemoStroke[];
  tool: MemoTool;
  color: string;
  onCommit: (strokes: MemoStroke[]) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const draftRef = useRef<MemoStroke | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = page.canvas;
    canvas.className = "block w-full h-auto";
    host.replaceChildren(canvas);
  }, [page]);

  const repaint = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    const draft = draftRef.current;
    paintStrokes(ctx, draft ? [...strokesRef.current, draft] : strokesRef.current, overlay.width, overlay.height);
  }, []);

  useEffect(() => {
    repaint();
  }, [repaint, strokes]);

  const pointOf = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / Math.max(1, rect.width)),
      y: clamp01((event.clientY - rect.top) / Math.max(1, rect.height)),
    };
  };

  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div ref={hostRef} />
      <canvas
        ref={overlayRef}
        width={page.width}
        height={page.height}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ cursor: tool === "eraser" ? "cell" : "crosshair" }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          draftRef.current = {
            tool,
            color: color,
            width: TOOL_WIDTHS[tool],
            points: [pointOf(event)],
          };
          repaint();
        }}
        onPointerMove={(event) => {
          const draft = draftRef.current;
          if (!draft) return;
          draft.points.push(pointOf(event));
          repaint();
        }}
        onPointerUp={(event) => {
          const draft = draftRef.current;
          draftRef.current = null;
          if (!draft) return;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          onCommit([...strokesRef.current, draft]);
        }}
        onPointerCancel={() => {
          draftRef.current = null;
          repaint();
        }}
      />
      <span className="pointer-events-none absolute bottom-1.5 right-2 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
        {page.index}쪽
      </span>
    </div>
  );
}

/**
 * Renders a worksheet PDF in the browser and lets the student write on it.
 * The memo is kept in localStorage and can be exported as a flattened PDF page
 * by page, so the teacher never needs to receive an upload.
 */
export function PdfAnnotator({
  blob,
  fileName,
  storeKey,
  compact = false,
}: {
  blob: Blob;
  fileName: string;
  storeKey: string;
  compact?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [tool, setTool] = useState<MemoTool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [memo, setMemo] = useState<Record<string, MemoStroke[]>>(() => readMemo(storeKey));
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const memoRef = useRef(memo);
  memoRef.current = memo;
  const storeKeyRef = useRef(storeKey);
  storeKeyRef.current = storeKey;

  useEffect(() => {
    setMemo(readMemo(storeKey));
  }, [storeKey]);

  // A quick tab switch can land between the last stroke and the debounced
  // write; flush it so the memo is never lost.
  useEffect(() => {
    return () => {
      if (!saveTimer.current) return;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      writeMemo(storeKeyRef.current, memoRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    setPages([]);
    setStatus("loading");
    setError(null);
    void (async () => {
      try {
        const opened = await openPdf(blob);
        cleanup = () => void opened.destroy();
        const pdf = opened.doc;
        if (cancelled) return;
        setTotal(pdf.numPages);
        const width = wrapRef.current?.clientWidth ?? 720;
        const count = Math.min(pdf.numPages, MAX_PAGES);
        for (let index = 1; index <= count; index += 1) {
          const page = await pdf.getPage(index);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(2.4, Math.max(0.45, width / Math.max(1, base.width)));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(viewport.width));
          canvas.height = Math.max(1, Math.round(viewport.height));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("캔버스를 만들지 못했습니다.");
          await page.render({ canvasContext: context, viewport }).promise;
          if (cancelled) return;
          setPages((current) => [...current, { index, width: canvas.width, height: canvas.height, canvas }]);
        }
        if (!cancelled) setStatus("ready");
      } catch (caught) {
        if (cancelled) return;
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "PDF를 열지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [blob]);

  const commit = useCallback(
    (pageIndex: number, strokes: MemoStroke[]) => {
      setMemo((current) => {
        const next = { ...current, [String(pageIndex)]: strokes };
        if (!strokes.length) delete next[String(pageIndex)];
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => writeMemo(storeKey, next), 400);
        return next;
      });
    },
    [storeKey],
  );

  const undo = () => {
    setMemo((current) => {
      const indexes = Object.keys(current)
        .map(Number)
        .sort((left, right) => right - left);
      for (const index of indexes) {
        const strokes = current[String(index)];
        if (strokes?.length) {
          const next = { ...current, [String(index)]: strokes.slice(0, -1) };
          if (!next[String(index)].length) delete next[String(index)];
          writeMemo(storeKey, next);
          return next;
        }
      }
      return current;
    });
  };

  const clearAll = () => {
    const next: Record<string, MemoStroke[]> = {};
    writeMemo(storeKey, next);
    setMemo(next);
  };

  /**
   * `both` keeps the worksheet pages and flattens the memo on top.
   * `memo` keeps only the pages that have ink, on a blank page, so a student
   * can hand in just their notes.
   */
  const exportPdf = async (mode: "both" | "memo") => {
    const targets =
      mode === "memo"
        ? pages.filter((page) =>
            (memo[String(page.index)] ?? []).some((stroke) => stroke.tool !== "eraser"),
          )
        : pages;
    if (!targets.length) return;
    setSaving(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();
      for (const page of targets) {
        const canvas = document.createElement("canvas");
        canvas.width = page.canvas.width;
        canvas.height = page.canvas.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (mode === "both") ctx.drawImage(page.canvas, 0, 0);
        // Paint the memo on a transparent layer first so the eraser removes ink
        // instead of punching a hole through the worksheet page.
        const memoLayer = document.createElement("canvas");
        memoLayer.width = canvas.width;
        memoLayer.height = canvas.height;
        const memoCtx = memoLayer.getContext("2d");
        if (memoCtx) {
          paintStrokes(memoCtx, memo[String(page.index)] ?? [], canvas.width, canvas.height);
          ctx.drawImage(memoLayer, 0, 0);
        }
        const image = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.92),
        );
        if (!image) continue;
        const bytes = new Uint8Array(await image.arrayBuffer());
        const embedded = await out.embedJpg(bytes);
        const widthPt = canvas.width * 0.75;
        const heightPt = canvas.height * 0.75;
        const target = out.addPage([widthPt, heightPt]);
        target.drawImage(embedded, { x: 0, y: 0, width: widthPt, height: heightPt });
      }
      const saved = await out.save();
      const buffer = new ArrayBuffer(saved.byteLength);
      new Uint8Array(buffer).set(saved);
      const base = fileName.replace(/\.pdf$/i, "") || "학습지";
      downloadBlob(
        new Blob([buffer], { type: "application/pdf" }),
        `${base}-${mode === "memo" ? "메모만" : "메모 포함"}.pdf`,
      );
    } finally {
      setSaving(false);
    }
  };

  const inkCount = memoHasInk(memo)
    ? Object.values(memo).reduce((sum, strokes) => sum + strokes.length, 0)
    : 0;

  return (
    <div ref={wrapRef} className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2">
        {(Object.keys(TOOL_LABEL) as MemoTool[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTool(item)}
            className={cx(
              "rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold ring-1 transition",
              tool === item
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100",
            )}
          >
            {TOOL_LABEL[item]}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {COLORS.map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`메모 색 ${value}`}
            onClick={() => {
              setColor(value);
              if (tool === "eraser") setTool("pen");
            }}
            className={cx(
              "h-5 w-5 rounded-full ring-2 ring-offset-2 transition",
              color === value && tool !== "eraser" ? "ring-slate-900" : "ring-transparent",
            )}
            style={{ backgroundColor: value }}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button
          type="button"
          onClick={undo}
          disabled={!inkCount}
          className="rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
        >
          되돌리기
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={!inkCount}
          className="rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
        >
          메모 지우기
        </button>
        <span className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void exportPdf("memo")}
            disabled={status !== "ready" || saving || !inkCount}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
          >
            {saving ? <Spinner className="h-3.5 w-3.5" /> : <IconDownload size={13} />}
            메모만 저장
          </button>
          <button
            type="button"
            onClick={() => void exportPdf("both")}
            disabled={status !== "ready" || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <IconDownload size={13} /> 원본+메모 PDF
          </button>
        </span>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-400">
        <span>필기는 이 기기에만 저장되고 선생님께 전송되지 않습니다.</span>
        {inkCount ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
            <IconCheck size={11} /> 필기 {inkCount}개
          </span>
        ) : (
          <span>PDF 위를 손가락이나 마우스로 그으면 메모가 됩니다.</span>
        )}
      </p>

      {status === "loading" ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white py-10 text-[12px] text-slate-500">
          <Spinner className="h-4 w-4 text-brand-500" />
          PDF를 여는 중… {pages.length}/{total || "?"}쪽
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
          {error ?? "PDF를 열지 못했습니다."}
        </div>
      ) : null}

      <div className={cx("space-y-3", compact && "max-h-[520px] overflow-y-auto pr-1")}>
        {pages.map((page) => (
          <MemoPage
            key={page.index}
            page={page}
            strokes={memo[String(page.index)] ?? []}
            tool={tool}
            color={color}
            onCommit={(strokes) => commit(page.index, strokes)}
          />
        ))}
      </div>

      {total > MAX_PAGES && status === "ready" ? (
        <p className="flex items-center gap-1.5 text-[10.5px] text-amber-600">
          <IconX size={11} /> 이 PDF는 {total}쪽입니다. 앞 {MAX_PAGES}쪽까지만 표시합니다.
        </p>
      ) : null}


    </div>
  );
}
