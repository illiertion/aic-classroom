import { useCallback, useRef, useState } from "react";
import type { BoardCard } from "../../shared/protocol";
import { IconChat, IconHeart, IconTrash, IconX } from "./Icons";
import { cx } from "./ui";

const CARD_WIDTH = 240;
const CARD_GAP = 14;
const PER_ROW = 3;

/**
 * 패들렛형 벽면 보드. 카드를 자유롭게 끌어 옮기고, 하트와 댓글을 남깁니다.
 * 좌표·좋아요·댓글은 모두 서버(Durable Object)에 저장되어 학생 화면과 동기화됩니다.
 */
export function BoardCanvas({
  cards,
  colorClass,
  selfId = null,
  canMove = false,
  canComment = true,
  canDelete = false,
  onMove,
  onLike,
  onComment,
  onCommentRemove,
  onDelete,
  height = 460,
}: {
  cards: BoardCard[];
  colorClass: Record<string, string>;
  selfId?: string | null;
  canMove?: boolean;
  canComment?: boolean;
  canDelete?: boolean;
  onMove?: (cardId: string, x: number, y: number) => void;
  onLike?: (cardId: string) => void;
  onComment?: (cardId: string, text: string) => void;
  onCommentRemove?: (commentId: string) => void;
  onDelete?: (cardId: string) => void;
  height?: number;
}) {
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragging = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  const positionOf = useCallback(
    (card: BoardCard, index: number) => {
      if (drag && drag.id === card.id) return { x: drag.x, y: drag.y };
      if (card.x !== null && card.y !== null) return { x: card.x, y: card.y };
      return {
        x: 10 + (index % PER_ROW) * (CARD_WIDTH + CARD_GAP),
        y: 10 + Math.floor(index / PER_ROW) * 190,
      };
    },
    [drag],
  );

  const startDrag = (card: BoardCard, index: number, event: React.PointerEvent<HTMLDivElement>) => {
    if (!canMove || !onMove) return;
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = positionOf(card, index);
    dragging.current = {
      id: card.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
    };
    setDrag({ id: card.id, x: origin.x, y: origin.y });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = dragging.current;
    if (!current) return;
    const x = Math.max(0, current.originX + (event.clientX - current.startX));
    const y = Math.max(0, current.originY + (event.clientY - current.startY));
    setDrag({ id: current.id, x, y });
  };

  const endDrag = () => {
    const current = dragging.current;
    dragging.current = null;
    if (!current || !drag) {
      setDrag(null);
      return;
    }
    if (drag.x !== current.originX || drag.y !== current.originY) {
      onMove?.(current.id, drag.x, drag.y);
    }
    setDrag(null);
  };

  const sendComment = (cardId: string) => {
    const text = (drafts[cardId] ?? "").trim();
    if (!text || !onComment) return;
    onComment(cardId, text);
    setDrafts((previous) => ({ ...previous, [cardId]: "" }));
  };

  return (
    <div
      className="relative w-full overflow-auto rounded-2xl bg-slate-100/70 ring-1 ring-slate-200"
      style={{ height }}
    >
      <div className="relative" style={{ minHeight: height - 2, minWidth: 780 }}>
        {cards.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center text-[12px] text-slate-400">
            아직 카드가 없습니다.
          </p>
        ) : null}
        {cards.map((card, index) => {
          const position = positionOf(card, index);
          const liked = selfId ? card.likedBy.includes(selfId) : false;
          const open = openComments === card.id;
          return (
            <div
              key={card.id}
              onPointerDown={(event) => startDrag(card, index, event)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{ left: position.x, top: position.y, width: CARD_WIDTH }}
              className={cx(
                "absolute rounded-xl p-3 text-[12.5px] leading-relaxed shadow-sm ring-1 select-text",
                colorClass[card.color] ?? colorClass.yellow,
                canMove ? "cursor-grab active:cursor-grabbing" : "",
                drag?.id === card.id ? "z-20 shadow-lg" : "z-10",
              )}
            >
              <p className="whitespace-pre-wrap break-words">{card.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] opacity-70">
                <span className="font-semibold">{card.author}</span>
                <button
                  type="button"
                  onClick={() => onLike?.(card.id)}
                  className={cx(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition",
                    liked ? "bg-rose-500/90 text-white" : "hover:bg-black/5",
                  )}
                  aria-label="하트"
                >
                  <IconHeart size={12} /> {card.likes}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenComments(open ? null : card.id)}
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-black/5"
                  aria-label="댓글"
                >
                  <IconChat size={12} /> {card.comments.length}
                </button>
                {canDelete && onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(card.id)}
                    className="ml-auto rounded-full p-1 transition hover:bg-black/10"
                    aria-label="카드 삭제"
                  >
                    <IconTrash size={12} />
                  </button>
                ) : null}
              </div>

              {open ? (
                <div
                  className="mt-2 space-y-1.5 rounded-lg bg-white/85 p-2 text-[11px] text-slate-700 ring-1 ring-black/5"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {card.comments.length === 0 ? (
                    <p className="text-slate-400">첫 댓글을 남겨 보세요.</p>
                  ) : null}
                  {card.comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-1.5">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-800">{comment.author}</span>{" "}
                        <span className="break-words">{comment.text}</span>
                      </div>
                      {canDelete && onCommentRemove ? (
                        <button
                          type="button"
                          onClick={() => onCommentRemove(comment.id)}
                          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100"
                          aria-label="댓글 삭제"
                        >
                          <IconX size={10} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {canComment && onComment ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={drafts[card.id] ?? ""}
                        onChange={(event) =>
                          setDrafts((previous) => ({ ...previous, [card.id]: event.target.value }))
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                          sendComment(card.id);
                        }}
                        maxLength={160}
                        placeholder="댓글"
                        className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-brand-400"
                      />
                      <button
                        type="button"
                        onClick={() => sendComment(card.id)}
                        className="rounded-md bg-brand-600 px-2 py-1 text-[10.5px] font-bold text-white"
                      >
                        등록
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
