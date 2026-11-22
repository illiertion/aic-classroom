import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ClientMessage,
  LiveQuiz,
  QuizResults,
  SharedMaterial,
  WorksheetField,
  WorksheetState,
  WorksheetSubmission,
} from "../../../shared/protocol";
import { MAX_MATERIAL_BYTES } from "../../../shared/protocol";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  cx,
} from "../../components/ui";
import {
  IconCast,
  IconCheck,
  IconDownload,
  IconEye,
  IconFileText,
  IconInfo,
  IconPlus,
  IconRefresh,
  IconSparkles,
  IconTrash,
  IconUsers,
  IconX,
} from "../../components/Icons";
import { formatBytes, formatTime } from "../../lib/format";
import { saveMaterial } from "../../lib/materialStore";
import { downloadText } from "../../lib/boardStore";

let fieldSeed = 0;

function newField(type: WorksheetField["type"] = "short", label = ""): WorksheetField {
  fieldSeed += 1;
  return { id: `draft_${Date.now().toString(36)}_${fieldSeed}`, label, type, answer: null };
}

const TYPE_LABEL: Record<WorksheetField["type"], string> = {
  short: "단답",
  long: "서술",
  ox: "O/X",
};

/** Same normalisation the server uses for auto-grading. */
function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function ToolsTab({
  quiz,
  results,
  worksheet,
  submissions,
  send,
  connected,
  studentCount,
}: {
  quiz: LiveQuiz | null;
  results: QuizResults | null;
  worksheet: WorksheetState | null;
  submissions: WorksheetSubmission[];
  send: (message: ClientMessage) => void;
  connected: boolean;
  studentCount: number;
}) {
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [editing, setEditing] = useState(true);
  const [worksheetPrompt, setWorksheetPrompt] = useState(worksheet?.prompt ?? "");
  const [fields, setFields] = useState<WorksheetField[]>(() =>
    worksheet?.fields.length ? worksheet.fields.map((field) => ({ ...field })) : [newField("short")],
  );
  const [material, setMaterial] = useState<SharedMaterial | null>(worksheet?.material ?? null);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [materialBusy, setMaterialBusy] = useState(false);
  const [worksheetError, setWorksheetError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<WorksheetSubmission | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const syncedWorksheetId = useRef<string | null>(worksheet?.id ?? null);

  // Refresh the editor when a different worksheet becomes live (page reload,
  // another tab publishing, or a worksheet the server already had).
  useEffect(() => {
    const id = worksheet?.id ?? null;
    if (id === syncedWorksheetId.current) return;
    syncedWorksheetId.current = id;
    setWorksheetPrompt(worksheet?.prompt ?? "");
    setFields(
      worksheet?.fields.length ? worksheet.fields.map((field) => ({ ...field })) : [newField("short")],
    );
    setMaterial(worksheet?.material ?? null);
    setWorksheetError(null);
  }, [worksheet]);

  const startQuiz = () => {
    const filled = options.map((option) => option.trim()).filter(Boolean);
    if (!prompt.trim() || filled.length < 2) return;
    send({ type: "quiz_start", prompt: prompt.trim(), options: filled });
    setEditing(false);
  };

  const pickPdf = async (file: File) => {
    setMaterialBusy(true);
    setMaterialError(null);
    try {
      const saved = await saveMaterial(file);
      setMaterial(saved.meta);
      if (!worksheetPrompt.trim()) {
        setWorksheetPrompt(`${saved.meta.name.replace(/\.pdf$/i, "")} 학습지`);
      }
    } catch (caught) {
      setMaterialError(caught instanceof Error ? caught.message : "PDF를 읽지 못했습니다.");
    } finally {
      setMaterialBusy(false);
    }
  };

  const publishWorksheet = () => {
    const cleaned = fields
      .map((field) => ({
        ...field,
        label: field.label.trim(),
        answer: field.answer?.trim() ? field.answer.trim() : null,
      }))
      .filter((field) => field.label);
    if (!worksheetPrompt.trim()) {
      setWorksheetError("학습지 안내 문구를 입력해 주세요.");
      return;
    }
    if (cleaned.length === 0 && !material) {
      setWorksheetError("문항을 하나 이상 만들거나 PDF를 붙여 주세요.");
      return;
    }
    setWorksheetError(null);
    send({
      type: "worksheet_set",
      prompt: worksheetPrompt.trim(),
      material,
      fields: cleaned.map((field, index) => ({ ...field, id: `f${index + 1}` })),
    });
  };

  const updateField = (id: string, patch: Partial<WorksheetField>) => {
    setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };

  const addField = (type: WorksheetField["type"] = "short") => {
    setFields((current) => [...current, newField(type)]);
  };

  const applyPreset = (preset: "short" | "ox" | "essay") => {
    if (preset === "short") {
      setFields(
        Array.from({ length: 3 }, (_, index) => newField("short", `${index + 1}번 정답을 쓰세요.`)),
      );
    } else if (preset === "ox") {
      setFields(
        Array.from({ length: 5 }, (_, index) => ({
          ...newField("ox", `${index + 1}번 문장이 맞으면 O, 틀리면 X`),
          answer: "O",
        })),
      );
    } else {
      setFields(
        Array.from({ length: 2 }, (_, index) => newField("long", `${index + 1}번 생각을 자세히 쓰세요.`)),
      );
    }
  };

  const totalAnswers = results?.answerCount ?? quiz?.answerCount ?? 0;
  const graded = useMemo(() => fields.filter((field) => field.answer?.trim()), [fields]);
  const scoredSubmissions = submissions.filter((submission) => submission.score !== null && submission.maxScore);

  const answersText = (submission: WorksheetSubmission): string => {
    if (!worksheet) return submission.text;
    if (!worksheet.fields.length) return submission.text;
    return worksheet.fields
      .map((field, index) => `${index + 1}. ${field.label}\n${submission.answers[field.id]?.trim() || "(빈 응답)"}`)
      .join("\n\n");
  };

  const showToClass = (submission: WorksheetSubmission) => {
    if (!worksheet) return;
    send({
      type: "stage_set",
      kind: "note",
      title: `${submission.studentName} 학습지`,
      body: answersText(submission).slice(0, 3500),
    });
  };

  const showModelAnswers = () => {
    if (!worksheet) return;
    if (!worksheet.fields.length) {
      setWorksheetError("안내문만 있는 학습지는 정답을 보여 줄 문항이 없습니다.");
      return;
    }
    const body = worksheet.fields
      .map((field, index) => `${index + 1}. ${field.label}\n정답: ${field.answer || "(자동 채점 없음)"}`)
      .join("\n\n");
    send({ type: "stage_set", kind: "note", title: "학습지 정답", body: body.slice(0, 3500) });
  };

  const exportCsv = () => {
    if (!worksheet) return;
    const header = ["이름", "제출시각", "점수", ...worksheet.fields.map((field) => field.label)];
    const lines = [header.join(",")];
    for (const submission of submissions) {
      const row = [
        submission.studentName,
        formatTime(submission.updatedAt),
        submission.score === null ? "" : `${submission.score}/${submission.maxScore ?? ""}`,
        ...worksheet.fields.map((field) => submission.answers[field.id] ?? ""),
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
      lines.push(row.join(","));
    }
    downloadText(`${worksheet.prompt.slice(0, 20) || "worksheet"}-제출.csv`, `\ufeff${lines.join("\n")}`);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <CardHeader
            title="실시간 문제"
            description="수업을 벗어나지 않고 한 문제씩 진행합니다. 결과는 실시간으로 집계됩니다."
            action={
              <Badge tone={quiz?.status === "open" ? "ok" : "neutral"} dot={quiz?.status === "open"}>
                {quiz
                  ? `${quiz.mode === "spell" ? "스펠링" : quiz.mode === "ox" ? "OX" : "객관식"} · ${quiz.status === "open" ? "진행 중" : "마감"}`
                  : "대기"}
              </Badge>
            }
          />
        </div>

        <div className="space-y-4 p-5">
          {!connected ? (
            <Callout tone="warn" icon={<IconInfo size={15} />}>
              실시간 연결이 끊겨 있습니다. 재연결되면 다시 시도해 주세요.
            </Callout>
          ) : null}

          {!quiz || editing ? (
            <div className="space-y-3">
              <Field label="질문" htmlFor="quiz-prompt">
                <Input
                  id="quiz-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  maxLength={300}
                  placeholder="예: 물의 화학식은?"
                />
              </Field>
              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-slate-700">선택지 (2~6개)</p>
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <Input
                      value={option}
                      maxLength={120}
                      placeholder={`선택지 ${index + 1}`}
                      onChange={(event) =>
                        setOptions((prev) =>
                          prev.map((value, position) => (position === index ? event.target.value : value)),
                        )
                      }
                      className="h-10"
                    />
                    {options.length > 2 ? (
                      <button
                        onClick={() => setOptions((prev) => prev.filter((_, position) => position !== index))}
                        className="shrink-0 px-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600"
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                ))}
                {options.length < 6 ? (
                  <Button variant="ghost" size="sm" onClick={() => setOptions((prev) => [...prev, ""])}>
                    <IconPlus size={14} /> 선택지 추가
                  </Button>
                ) : null}
              </div>
              <div className="flex justify-end gap-2">
                {quiz ? (
                  <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                    취소
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  disabled={!connected || !prompt.trim() || options.filter((option) => option.trim()).length < 2}
                  onClick={startQuiz}
                >
                  <IconSparkles size={14} /> 퀴즈 시작
                </Button>
              </div>
              {quiz ? (
                <Callout tone="warn" icon={<IconInfo size={15} />}>
                  새 문제를 시작하면 정답이 공개되고 점수가 쌓입니다. 게임 점수는 게임 탭에서 초기화할 수
                  있습니다.
                </Callout>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[15px] font-bold text-slate-900">{quiz.prompt}</p>
                <p className="mt-1 flex items-center gap-3 text-[11.5px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <IconUsers size={13} /> 응답 {totalAnswers}/{studentCount}
                  </span>
                  <span>시작 {formatTime(quiz.startedAt)}</span>
                </p>
              </div>
              {quiz.mode === "spell" ? (
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">
                    입력 답변 · 정답 {results?.correctAnswer ?? "미설정"}
                  </p>
                  {results?.responses.length ? (
                    results.responses.map((response) => (
                      <div
                        key={response.participantId}
                        className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[12px]"
                      >
                        <span className="min-w-0 break-words text-slate-700">
                          <span className="font-semibold">{response.studentName}</span>: {response.text}
                        </span>
                        {response.correct === true ? (
                          <Badge tone="ok">정답</Badge>
                        ) : response.correct === false ? (
                          <Badge tone="neutral">다름</Badge>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-[11.5px] text-slate-400">아직 입력한 학생이 없습니다.</p>
                  )}
                  {results && results.correctCount > 0 ? (
                    <p className="text-[11px] font-semibold text-emerald-700">정답 {results.correctCount}명</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {quiz.options.map((option, index) => {
                    const tally = results?.tallies[option.id] ?? 0;
                    const percent = totalAnswers > 0 ? Math.round((tally / totalAnswers) * 100) : 0;
                    return (
                      <div key={option.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="flex items-center gap-2 font-medium text-slate-800">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-[10.5px] font-bold text-slate-500">
                              {String.fromCharCode(65 + index)}
                            </span>
                            {option.label}
                          </span>
                          <span className="shrink-0 text-[11.5px] font-semibold text-slate-500">
                            {tally}명 · {percent}%
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {quiz.correctAnswer ? (
                <p className="text-[11.5px] font-semibold text-emerald-700">정답: {quiz.correctAnswer}</p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  새 질문
                </Button>
                {quiz.status === "open" ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!connected}
                    onClick={() => send({ type: "quiz_close" })}
                  >
                    응답 마감
                  </Button>
                ) : (
                  <Badge tone="neutral">응답이 마감되었습니다</Badge>
                )}
                <Button
                  size="sm"
                  disabled={!connected}
                  onClick={() => {
                    const lines: string[] = [];
                    lines.push(`응답 ${totalAnswers}/${studentCount}명`);
                    if (quiz.correctAnswer) lines.push(`정답: ${quiz.correctAnswer}`);
                    if (results && results.correctCount > 0) lines.push(`정답 ${results.correctCount}명`);
                    if (quiz.mode !== "spell") {
                      for (const option of quiz.options) {
                        const tally = results?.tallies[option.id] ?? 0;
                        if (tally > 0) lines.push(`${option.label}: ${tally}명`);
                      }
                    } else if (results?.responses.length) {
                      lines.push("");
                      for (const response of results.responses) {
                        lines.push(
                          `${response.studentName}: ${response.text ?? "—"}${response.correct === true ? " ✅" : ""}`,
                        );
                      }
                    }
                    send({
                      type: "stage_set",
                      kind: "note",
                      title: "퀴즈 결과",
                      body: lines.join("\n").slice(0, 3500),
                      requireFullscreen: false,
                    });
                    send({ type: "nudge_all", text: "퀴즈 결과가 공개되었습니다." });
                  }}
                >
                  <IconCast size={14} /> 결과를 학생에게 띄우기
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <CardHeader
            title="학습지 만들기"
            description="PDF를 붙이고 AIC 안에서 바로 풀 문항을 만들 수 있습니다. 학생은 PDF를 보며 펜·형광펜으로 메모하고, 메모까지 포함한 PDF로 저장할 수 있습니다."
            action={
              <Badge tone={worksheet ? "brand" : "neutral"}>
                {worksheet ? `제출 ${worksheet.submissionCount}명` : "대기"}
              </Badge>
            }
          />
        </div>
        <div className="space-y-4 p-5">
          <Field label="학습지 안내" htmlFor="worksheet-prompt">
            <Input
              id="worksheet-prompt"
              value={worksheetPrompt}
              onChange={(event) => setWorksheetPrompt(event.target.value)}
              maxLength={500}
              placeholder="예: 첨부한 PDF를 읽고 아래 문항에 답하세요."
            />
          </Field>

          <div className="rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
              <p className="text-[12px] font-semibold text-slate-800">안에서 푸는 문항</p>
              <div className="flex flex-wrap gap-1">
                {(["short", "ox", "long"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => addField(type)}
                    className="rounded-md bg-slate-100 px-2 py-1 text-[10.5px] font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    + {TYPE_LABEL[type]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 p-3">
              {fields.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-slate-400">
                  문항이 없습니다. 위 버튼으로 추가하거나 PDF만 배포할 수 있습니다.
                </p>
              ) : null}
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-lg bg-slate-50 p-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-4 shrink-0 text-[11px] font-bold text-slate-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Input
                        value={field.label}
                        onChange={(event) => updateField(field.id, { label: event.target.value })}
                        maxLength={140}
                        placeholder="문항 내용"
                        className="h-8 text-[12px]"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Select
                          value={field.type}
                          onChange={(event) =>
                            updateField(field.id, { type: event.target.value as WorksheetField["type"] })
                          }
                          className="h-8 w-24 text-[11.5px]"
                        >
                          <option value="short">단답</option>
                          <option value="long">서술</option>
                          <option value="ox">O/X</option>
                        </Select>
                        <Input
                          value={field.answer ?? ""}
                          onChange={(event) =>
                            updateField(field.id, { answer: event.target.value || null })
                          }
                          maxLength={200}
                          placeholder="정답(선택, 자동 채점)"
                          className="h-8 min-w-[120px] flex-1 text-[11.5px]"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}
                      className="mt-1.5 shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600"
                      aria-label="문항 삭제"
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10.5px] text-slate-400">빠른 양식:</span>
                <button onClick={() => applyPreset("short")} className="rounded bg-white px-2 py-1 text-[10.5px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                  단답 3문항
                </button>
                <button onClick={() => applyPreset("ox")} className="rounded bg-white px-2 py-1 text-[10.5px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                  OX 5문항
                </button>
                <button onClick={() => applyPreset("essay")} className="rounded bg-white px-2 py-1 text-[10.5px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                  서술 2문항
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800">
                  <IconFileText size={14} className="text-brand-600" /> 학습지 PDF (선택)
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                  {material
                    ? `${material.name} · ${formatBytes(material.size)}`
                    : `PDF 선택 (최대 ${Math.round(MAX_MATERIAL_BYTES / (1024 * 1024))}MB)`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {material ? (
                  <button
                    onClick={() => setMaterial(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="선택한 PDF 제거"
                  >
                    <IconX size={14} />
                  </button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  loading={materialBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  <IconFileText size={14} /> PDF 선택
                </Button>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void pickPdf(file);
                event.target.value = "";
              }}
            />
            {materialError ? (
              <Callout tone="warn" icon={<IconInfo size={14} />} className="mt-2">
                {materialError}
              </Callout>
            ) : null}
          </div>

          {worksheetError ? (
            <Callout tone="warn" icon={<IconInfo size={14} />}>
              {worksheetError}
            </Callout>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10.5px] text-slate-400">
              {fields.filter((field) => field.label.trim()).length}문항
              {graded.length ? ` · 자동 채점 ${graded.length}문항` : ""}
            </p>
            <Button disabled={!connected} onClick={publishWorksheet}>
              <IconFileText size={15} /> 학습지 배포
            </Button>
          </div>

          {worksheet ? (
            <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
                진행 중인 학습지
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-800">
                {worksheet.prompt}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="brand">{worksheet.fields.length}문항</Badge>
                {worksheet.material ? <Badge tone="neutral">PDF 첨부</Badge> : null}
                {scoredSubmissions.length ? (
                  <Badge tone="ok">
                    평균{" "}
                    {(
                      scoredSubmissions.reduce(
                        (sum, submission) => sum + (submission.score ?? 0),
                        0,
                      ) / scoredSubmissions.length
                    ).toFixed(1)}
                    점
                  </Badge>
                ) : null}
              </div>
            </div>
          ) : null}

          {submissions.length === 0 ? (
            <EmptyState
              icon={<IconFileText size={21} />}
              title="제출된 학습지가 없습니다"
              description={worksheet ? "학생이 제출하면 실시간으로 표시됩니다." : "학습지를 배포해 보세요."}
              className="py-8"
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11.5px] font-semibold text-slate-600">제출 {submissions.length}명</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="secondary" disabled={!connected} onClick={showModelAnswers}>
                    <IconCast size={13} /> 정답 보여주기
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!connected || submissions.length === 0}
                    onClick={() => send({ type: "worksheet_reopen" })}
                  >
                    <IconRefresh size={13} /> 전체 다시 제출 허용
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportCsv}>
                    <IconDownload size={13} /> CSV 저장
                  </Button>
                </div>
              </div>
              <div className="max-h-[360px] space-y-2 overflow-y-auto scrollbar-thin pr-1">
                {submissions.map((submission) => (
                  <div
                    key={submission.participantId}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800">
                        <IconCheck size={12} className="text-emerald-500" />
                        {submission.studentName}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {submission.score !== null && submission.maxScore ? (
                          <Badge
                            tone={submission.score === submission.maxScore ? "ok" : "neutral"}
                          >
                            {submission.score}/{submission.maxScore}점
                          </Badge>
                        ) : null}
                        <span className="text-[10px] text-slate-400">
                          {formatTime(submission.updatedAt)}
                        </span>
                      </div>
                    </div>
                    {worksheet?.fields.length ? (
                      <dl className="mt-2 space-y-1.5">
                        {worksheet.fields.map((field) => {
                          const value = submission.answers[field.id] ?? "";
                          const correct = field.answer
                            ? normalizeAnswer(value) === normalizeAnswer(field.answer)
                            : null;
                          return (
                            <div key={field.id} className="text-[11.5px] leading-relaxed">
                              <dt className="text-slate-400">{field.label}</dt>
                              <dd
                                className={cx(
                                  "mt-0.5 whitespace-pre-wrap rounded-md px-2 py-1",
                                  correct === true
                                    ? "bg-emerald-50 text-emerald-800"
                                    : correct === false
                                      ? "bg-rose-50 text-rose-700"
                                      : "bg-slate-50 text-slate-700",
                                )}
                              >
                                {value || "(빈 응답)"}
                                {correct === true ? " ✓" : correct === false ? " ✗" : ""}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600">
                        {submission.text || <span className="text-slate-400">(빈 응답)</span>}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(submission)}>
                        <IconEye size={12} /> 크게 보기
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!connected}
                        onClick={() => showToClass(submission)}
                      >
                        <IconCast size={12} /> 전체에게 띄우기
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!connected}
                        onClick={() => send({ type: "worksheet_reopen", to: submission.participantId })}
                      >
                        <IconRefresh size={12} /> 다시 제출 허용
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
            <IconInfo size={13} className="mt-0.5 shrink-0" />
            PDF는 서버에 업로드되지 않습니다. 이 컴퓨터에 보관되고, 콘솔이 열려 있는 동안 학생이
            요청하면 그때만 전송됩니다.
          </p>
        </div>
      </Card>

      {quiz && !editing ? (
        <div className={cx("lg:col-span-2 text-[11px] text-slate-400")}>
          <IconCheck size={12} className="mr-1 inline text-emerald-500" />
          퀴즈·학습지는 수업 세션 상태로 저장되어 학생이 재접속하면 현재 활동이 복원됩니다.
        </div>
      ) : null}

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.studentName} 학습지` : "학습지"}
        description={worksheet?.prompt}
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewing(null)}>
              닫기
            </Button>
            {viewing ? (
              <Button disabled={!connected} onClick={() => showToClass(viewing)}>
                <IconCast size={14} /> 전체에게 띄우기
              </Button>
            ) : null}
          </>
        }
      >
        {viewing ? (
          <div className="space-y-3">
            {viewing.score !== null && viewing.maxScore ? (
              <Badge tone={viewing.score === viewing.maxScore ? "ok" : "neutral"}>
                {viewing.score}/{viewing.maxScore}점
              </Badge>
            ) : null}
            <pre className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-800">
              {answersText(viewing)}
            </pre>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
