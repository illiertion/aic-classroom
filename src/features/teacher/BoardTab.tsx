import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ClientMessage, LiveBoard } from "../../../shared/protocol";
import {
  BOARD_TEMPLATES,
  boardFromTemplate,
  boardToLive,
  listBoards,
  saveBoard,
  type SavedBoard,
} from "../../lib/boardStore";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Toggle,
  cx,
} from "../../components/ui";
import {
  IconAlert,
  IconCast,
  IconCheck,
  IconClock,
  IconInfo,
  IconLayout,
  IconPlus,
  IconTrash,
  IconX,
} from "../../components/Icons";
import { formatTime } from "../../lib/format";

const COLOR_CLASS: Record<string, string> = {
  yellow: "bg-amber-100 text-amber-950 ring-amber-200",
  rose: "bg-rose-100 text-rose-950 ring-rose-200",
  sky: "bg-sky-100 text-sky-950 ring-sky-200",
  emerald: "bg-emerald-100 text-emerald-950 ring-emerald-200",
  violet: "bg-violet-100 text-violet-950 ring-violet-200",
  slate: "bg-slate-100 text-slate-900 ring-slate-200",
};

export function BoardTab({
  board,
  send,
  connected,
}: {
  board: LiveBoard | null;
  send: (message: ClientMessage) => void;
  connected: boolean;
}) {
  const [boards, setBoards] = useState<SavedBoard[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [cardText, setCardText] = useState("");
  const [cardColumn, setCardColumn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await listBoards();
      setBoards(list);
      setSelectedId((current) => current || list[0]?.id || "");
      setError(null);
    } catch (caught) {
      setBoards([]);
      setError(caught instanceof Error ? caught.message : "저장된 보드를 읽지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openSaved = async (saved: SavedBoard) => {
    setBusy(true);
    try {
      send({ type: "board_share", board: boardToLive(saved) });
      setError(null);
    } finally {
      setBusy(false);
    }
  };

  const openTemplate = async (templateKey: string) => {
    const template = BOARD_TEMPLATES.find((entry) => entry.templateKey === templateKey);
    if (!template) return;
    setBusy(true);
    try {
      const saved = await saveBoard(boardFromTemplate(template));
      await reload();
      send({ type: "board_share", board: boardToLive(saved) });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "템플릿을 열지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const addCard = () => {
    if (!board || !cardText.trim()) return;
    send({
      type: "board_add",
      text: cardText.trim(),
      color: "yellow",
      column: cardColumn || null,
    });
    setCardText("");
  };

  const toggleStudentPosts = (next: boolean) => {
    if (!board) return;
    send({ type: "board_share", board: { ...board, allowStudentPosts: next } });
  };

  const selected = boards?.find((entry) => entry.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <CardHeader
              title="내 보드함"
              description="보드는 이 컴퓨터에만 저장됩니다. 수업 중에 연 보드만 학생 화면에 나타납니다."
              action={
                <Link
                  to="/app/boards"
                  className="text-[11.5px] font-semibold text-brand-700 hover:text-brand-800"
                >
                  관리
                </Link>
              }
            />
          </div>
          <div className="space-y-3 p-4">
            {boards === null ? (
              <p className="text-[12px] text-slate-400">불러오는 중…</p>
            ) : boards.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-slate-500">
                저장된 보드가 없습니다. 아래 템플릿으로 바로 시작하거나 보드함에서 새로 만들어
                보세요.
              </p>
            ) : (
              <>
                <Field label="보드 선택" htmlFor="board-select">
                  <Select
                    id="board-select"
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                  >
                    {boards.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.title} · 카드 {entry.cards.length}장
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  className="w-full"
                  disabled={!connected || !selected || busy}
                  onClick={() => selected && void openSaved(selected)}
                >
                  <IconLayout size={15} /> 이 보드 열기
                </Button>
                {selected ? (
                  <p className="text-[10.5px] leading-relaxed text-slate-400">
                    {selected.layout === "columns"
                      ? `모둠형 · ${selected.columns.length}칸`
                      : "벽면형 · 카드 자유 배치"}{" "}
                    · {selected.allowStudentPosts ? "학생 글쓰기 허용" : "학생 글쓰기 꺼짐"}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <p className="text-[12.5px] font-bold text-slate-900">템플릿으로 바로 열기</p>
            <p className="mt-0.5 text-[11px] text-slate-400">패들렛·띵커벨형 활동을 미리 만들어 둡니다.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {BOARD_TEMPLATES.map((template) => (
              <div key={template.templateKey} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-slate-800">{template.title}</p>
                  <p className="text-[10.5px] text-slate-400">{template.tagline}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!connected || busy}
                  onClick={() => void openTemplate(template.templateKey)}
                >
                  열기
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {error ? (
          <Callout tone="warn" icon={<IconAlert size={15} />}>
            {error}
          </Callout>
        ) : null}
      </div>

      <div className="space-y-4">
        {!board ? (
          <Card>
            <EmptyState
              icon={<IconLayout size={22} />}
              title="공유 중인 보드가 없습니다"
              description="왼쪽에서 보드를 열면 학생 화면에 실시간 보드가 나타납니다. 수업 콘솔을 닫으면 학생 화면에서 사라집니다."
            />
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="ok" dot>
                        학생에게 공유 중
                      </Badge>
                      <Badge tone="brand">카드 {board.cards.length}장</Badge>
                    </div>
                    <h2 className="mt-2 text-[17px] font-bold tracking-tight text-slate-900">
                      {board.title}
                    </h2>
                    {board.instructions ? (
                      <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-500">
                        {board.instructions}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500">학생 글쓰기</span>
                    <Toggle
                      checked={board.allowStudentPosts}
                      onChange={toggleStudentPosts}
                      label="학생 글쓰기 허용"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        send({
                          type: "stage_set",
                          kind: "board",
                          title: board.title,
                          requireFullscreen: true,
                        })
                      }
                    >
                      <IconCast size={14} /> 학생 화면에 띄우기
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => send({ type: "board_close" })}
                    >
                      <IconX size={14} /> 공유 중지
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="카드 추가" htmlFor="board-card" className="min-w-[220px] flex-1">
                    <Input
                      id="board-card"
                      value={cardText}
                      onChange={(event) => setCardText(event.target.value)}
                      maxLength={280}
                      placeholder="학생에게 보여 줄 카드 내용"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) addCard();
                      }}
                    />
                  </Field>
                  {board.layout === "columns" && board.columns.length > 0 ? (
                    <Field label="칸" htmlFor="board-column" className="w-32">
                      <Select
                        id="board-column"
                        value={cardColumn}
                        onChange={(event) => setCardColumn(event.target.value)}
                      >
                        <option value="">공통</option>
                        {board.columns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                  <Button disabled={!cardText.trim()} onClick={addCard}>
                    <IconPlus size={15} /> 추가
                  </Button>
                </div>
                <p className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
                  <IconInfo size={12} /> 학생이 추가한 카드는 수업 중에만 보이며, 보드함에는
                  저장되지 않습니다.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
                <p className="text-[12.5px] font-bold text-slate-900">보드 내용</p>
                <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-400">
                  <IconClock size={12} /> {formatTime(board.updatedAt)} 갱신
                </span>
              </div>
              <div className="p-4">
                {board.layout === "columns" && board.columns.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {[...board.columns, ""].map((column) => {
                      const cards = board.cards.filter((card) => (card.column ?? "") === column);
                      if (!column && cards.length === 0) return null;
                      return (
                        <div key={column || "common"} className="rounded-xl bg-slate-50 p-3">
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            {column || "공통"}
                          </p>
                          <div className="space-y-2">
                            {cards.length === 0 ? (
                              <p className="text-[11px] text-slate-400">아직 카드가 없습니다.</p>
                            ) : null}
                            {cards.map((card) => (
                              <div
                                key={card.id}
                                className={cx(
                                  "group relative rounded-lg p-3 text-[12px] leading-relaxed ring-1",
                                  COLOR_CLASS[card.color] ?? COLOR_CLASS.yellow,
                                )}
                              >
                                <p className="whitespace-pre-wrap pr-5">{card.text}</p>
                                <p className="mt-1 text-[10px] opacity-60">{card.author}</p>
                                <button
                                  onClick={() => send({ type: "board_delete", cardId: card.id })}
                                  className="absolute right-1.5 top-1.5 rounded p-1 opacity-0 transition hover:bg-black/5 group-hover:opacity-100"
                                  aria-label="카드 삭제"
                                >
                                  <IconTrash size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {board.cards.length === 0 ? (
                      <p className="col-span-full py-6 text-center text-[12px] text-slate-400">
                        첫 카드를 추가하거나 학생의 글을 기다려 보세요.
                      </p>
                    ) : null}
                    {board.cards.map((card) => (
                      <div
                        key={card.id}
                        className={cx(
                          "group relative rounded-xl p-3.5 text-[12.5px] leading-relaxed ring-1",
                          COLOR_CLASS[card.color] ?? COLOR_CLASS.yellow,
                        )}
                      >
                        <p className="whitespace-pre-wrap pr-5">{card.text}</p>
                        <p className="mt-1.5 text-[10px] opacity-60">
                          {card.author} · {formatTime(card.createdAt)}
                        </p>
                        <button
                          onClick={() => send({ type: "board_delete", cardId: card.id })}
                          className="absolute right-2 top-2 rounded p-1 opacity-0 transition hover:bg-black/5 group-hover:opacity-100"
                          aria-label="카드 삭제"
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </>
        )}

        <Callout tone="info" icon={<IconCheck size={15} />}>
          보드는 선생님 컴퓨터의 브라우저 저장소(IndexedDB)에 보관됩니다. 서버에는 수업이 진행되는
          동안의 임시 사본만 있고, 콘솔을 닫으면 학생 화면에서 즉시 사라집니다.
        </Callout>
      </div>
    </div>
  );
}
