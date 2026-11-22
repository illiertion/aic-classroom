import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/AppShell";
import {
  BOARD_TEMPLATES,
  boardFromTemplate,
  deleteBoard,
  downloadText,
  exportBoards,
  listBoards,
  newBoardId,
  parseBoardExport,
  saveBoard,
  type SavedBoard,
} from "../lib/boardStore";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  Toggle,
  cx,
} from "../components/ui";
import {
  IconAlert,
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconFileText,
  IconLayout,
  IconPlus,
  IconSparkles,
  IconTrash,
} from "../components/Icons";
import { formatDate } from "../lib/format";

function blankBoard(): SavedBoard {
  const now = Date.now();
  return {
    id: newBoardId(),
    title: "",
    instructions: "",
    layout: "wall",
    columns: [],
    allowStudentPosts: true,
    cards: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function Boards() {
  const { teacher } = useAuth();
  const [boards, setBoards] = useState<SavedBoard[] | null>(null);
  const [draft, setDraft] = useState<SavedBoard | null>(null);
  const [columnsText, setColumnsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SavedBoard | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setBoards(await listBoards());
      setError(null);
    } catch (caught) {
      setBoards([]);
      setError(caught instanceof Error ? caught.message : "보드함을 읽지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!teacher) return null;

  const openEditor = (board: SavedBoard) => {
    setDraft({ ...board });
    setColumnsText(board.columns.join(", "));
    setError(null);
    setNotice(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const columns = columnsText
        .split(",")
        .map((column) => column.trim())
        .filter(Boolean)
        .slice(0, 8);
      const saved = await saveBoard({
        ...draft,
        columns: draft.layout === "columns" ? columns : [],
      });
      setDraft(null);
      await load();
      setNotice(`“${saved.title}” 보드를 저장했습니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "보드를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const addTemplate = async (templateKey: string) => {
    const template = BOARD_TEMPLATES.find((entry) => entry.templateKey === templateKey);
    if (!template) return;
    try {
      await saveBoard(boardFromTemplate(template));
      await load();
      setTemplateOpen(false);
      setNotice(`“${template.title}” 템플릿을 보드함에 추가했습니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "템플릿을 추가하지 못했습니다.");
    }
  };

  const remove = async () => {
    if (!removeTarget) return;
    await deleteBoard(removeTarget.id);
    setRemoveTarget(null);
    await load();
    setNotice("보드를 삭제했습니다.");
  };

  const onImport = async (file: File) => {
    try {
      const imported = parseBoardExport(await file.text());
      for (const board of imported) await saveBoard(board);
      await load();
      setNotice(`보드 ${imported.length}개를 가져왔습니다.`);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "보드를 가져오지 못했습니다.");
    }
  };

  return (
    <AppShell teacher={teacher} wide>
      <Link
        to="/app"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-slate-900"
      >
        <IconArrowLeft size={14} /> 내 수업
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-brand-600">LOCAL WORKSPACE</p>
          <h1 className="mt-2 text-[26px] font-extrabold tracking-[-0.03em] text-slate-900 sm:text-[30px]">
            활동 보드
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-500">
            패들렛·띵커벨형 보드를 미리 만들어 두고 수업에서 엽니다. 보드는 이 컴퓨터에만
            저장되며, 수업 콘솔에서 연 동안에만 학생에게 보입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => importRef.current?.click()}>
            <IconDownload size={15} /> 가져오기
          </Button>
          <Button variant="secondary" onClick={() => setTemplateOpen(true)}>
            <IconSparkles size={15} /> 템플릿
          </Button>
          <Button onClick={() => openEditor(blankBoard())}>
            <IconPlus size={16} /> 새 보드
          </Button>
        </div>
      </div>

      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onImport(file);
          event.target.value = "";
        }}
      />

      {notice ? (
        <Callout tone="ok" icon={<IconCheck size={15} />} className="mt-5">
          {notice}
        </Callout>
      ) : null}
      {error ? (
        <Callout tone="danger" icon={<IconAlert size={15} />} className="mt-5">
          {error}
        </Callout>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "저장된 보드", value: `${boards?.length ?? 0}개` },
          {
            label: "모둠형 보드",
            value: `${boards?.filter((board) => board.layout === "columns").length ?? 0}개`,
          },
          {
            label: "전체 카드",
            value: `${boards?.reduce((sum, board) => sum + board.cards.length, 0) ?? 0}장`,
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-[11.5px] font-medium text-slate-500">{stat.label}</p>
            <p className="mt-1 text-[20px] font-extrabold tracking-tight text-slate-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-900">내 보드함</h2>
        <div className="flex gap-2">
          <button
            onClick={() => boards && downloadText("aic-boards.json", exportBoards(boards))}
            className="text-[11.5px] font-semibold text-slate-500 hover:text-slate-900"
          >
            전체 내보내기
          </button>
          <button
            onClick={() => void load()}
            className="text-[11.5px] font-semibold text-slate-500 hover:text-slate-900"
          >
            새로고침
          </button>
        </div>
      </div>

      {boards === null ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<IconLayout size={22} />}
            title="아직 저장된 보드가 없습니다"
            description="템플릿으로 바로 시작하거나 새 보드를 만들어 보세요. 만든 보드는 이 컴퓨터에 저장됩니다."
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setTemplateOpen(true)}>
                  <IconSparkles size={15} /> 템플릿 보기
                </Button>
                <Button onClick={() => openEditor(blankBoard())}>
                  <IconPlus size={15} /> 새 보드
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {boards.map((board) => (
            <Card key={board.id} className="flex flex-col overflow-hidden">
              <div className="flex-1 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={board.layout === "columns" ? "brand" : "info"}>
                    {board.layout === "columns" ? "모둠형" : "벽면형"}
                  </Badge>
                  <Badge tone={board.allowStudentPosts ? "ok" : "neutral"}>
                    {board.allowStudentPosts ? "학생 글쓰기" : "교사만"}
                  </Badge>
                  <span className="text-[10.5px] text-slate-400">카드 {board.cards.length}장</span>
                </div>
                <h3 className="mt-2.5 truncate text-[16px] font-bold tracking-tight text-slate-900">
                  {board.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-500">
                  {board.instructions || "설명 없음"}
                </p>
                {board.layout === "columns" && board.columns.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {board.columns.map((column) => (
                      <span
                        key={column}
                        className="rounded-md bg-slate-50 px-2 py-1 text-[10.5px] font-medium text-slate-500 ring-1 ring-slate-200"
                      >
                        {column}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-[10.5px] text-slate-400">
                  수정 {formatDate(board.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                <Button size="sm" variant="secondary" onClick={() => openEditor(board)}>
                  편집
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    downloadText(
                      `${board.title.replace(/[^\w가-힣-]+/g, "-").slice(0, 40) || "board"}.json`,
                      exportBoards([board]),
                    )
                  }
                >
                  <IconFileText size={14} /> 내보내기
                </Button>
                <button
                  onClick={() => setRemoveTarget(board)}
                  className={cx(
                    "ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600",
                  )}
                >
                  <IconTrash size={13} /> 삭제
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Callout tone="info" icon={<IconLayout size={15} />} className="mt-6">
        수업에서 사용하려면 수업 콘솔의 <strong>활동 보드</strong> 탭에서 이 보드를 선택하세요.
        콘솔을 닫으면 학생 화면의 보드도 사라지고, 학생이 남긴 카드는 서버에 보관되지 않습니다.
      </Callout>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.title ? "보드 편집" : "새 보드"}
        description="보드는 선생님 컴퓨터에 저장됩니다. 수업 중에는 이 내용이 학생 화면에 실시간으로 공유됩니다."
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              취소
            </Button>
            <Button onClick={() => void saveDraft()} loading={saving} disabled={!draft?.title.trim()}>
              저장
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            <Field label="보드 제목" htmlFor="board-title">
              <Input
                id="board-title"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                maxLength={120}
                placeholder="예: 3학년 2반 생각 모으기"
                autoFocus
              />
            </Field>
            <Field
              label="안내 문구"
              htmlFor="board-instructions"
              hint="학생 화면 상단에 표시됩니다."
            >
              <Textarea
                id="board-instructions"
                value={draft.instructions}
                onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
                maxLength={400}
                placeholder="무엇을 카드로 남기면 되는지 적어 주세요."
                className="min-h-20"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="배치" htmlFor="board-layout">
                <Select
                  id="board-layout"
                  value={draft.layout}
                  onChange={(event) =>
                    setDraft({ ...draft, layout: event.target.value === "columns" ? "columns" : "wall" })
                  }
                >
                  <option value="wall">벽면형 (패들렛형)</option>
                  <option value="columns">모둠형 (띵커벨형)</option>
                </Select>
              </Field>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-[12.5px] font-semibold text-slate-800">학생 카드 작성</p>
                  <p className="text-[10.5px] text-slate-400">수업 중 학생이 카드를 붙일 수 있습니다.</p>
                </div>
                <Toggle
                  checked={draft.allowStudentPosts}
                  onChange={(next) => setDraft({ ...draft, allowStudentPosts: next })}
                  label="학생 카드 작성 허용"
                />
              </div>
            </div>
            {draft.layout === "columns" ? (
              <Field
                label="칸 이름"
                htmlFor="board-columns"
                hint="쉼표로 구분합니다. 최대 8칸 (예: 1모둠, 2모둠, 3모둠)"
              >
                <Input
                  id="board-columns"
                  value={columnsText}
                  onChange={(event) => setColumnsText(event.target.value)}
                  placeholder="1모둠, 2모둠, 3모둠"
                />
              </Field>
            ) : null}
            <Callout tone="info" icon={<IconLayout size={15} />}>
              카드는 수업 중에 추가합니다. 저장된 보드의 카드는 다음 수업에서도 그대로 이어집니다.
            </Callout>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="보드 템플릿"
        description="미리 만들어 둔 활동을 내 보드함에 추가합니다."
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {BOARD_TEMPLATES.map((template) => (
            <div key={template.templateKey} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <Badge tone={template.layout === "columns" ? "brand" : "info"}>
                  {template.layout === "columns" ? "모둠형" : "벽면형"}
                </Badge>
                <span className="text-[10.5px] text-slate-400">{template.tagline}</span>
              </div>
              <p className="mt-2 text-[13px] font-bold text-slate-900">{template.title}</p>
              <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">
                {template.instructions}
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => void addTemplate(template.templateKey)}
              >
                <IconPlus size={14} /> 보드함에 추가
              </Button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title="보드를 삭제할까요?"
        description="이 컴퓨터에서만 삭제됩니다. 수업 중 공유 중인 보드는 콘솔에서 다시 열어야 합니다."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoveTarget(null)}>
              취소
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              삭제
            </Button>
          </>
        }
      >
        <p className="text-[13px] font-semibold text-slate-800">{removeTarget?.title}</p>
      </Modal>
    </AppShell>
  );
}
