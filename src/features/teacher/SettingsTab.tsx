import { useEffect, useState } from "react";
import type { ClientMessage } from "../../../shared/protocol";
import { DEFAULT_SETTINGS, SEAT_RULES, type ClassSettings } from "../../../shared/settings";
import { Button, Callout, Card, CardHeader, Divider, Field, Input, Textarea, Toggle } from "../../components/ui";
import { IconAlert, IconCheck, IconRefresh } from "../../components/Icons";

interface Props {
  settings: ClassSettings;
  send: (message: ClientMessage) => void;
  connected: boolean;
}

/** 저장 전 값과 저장된 값을 비교해 "저장되지 않음"을 표시합니다. */
function sameSettings(a: ClassSettings, b: ClassSettings): boolean {
  return (Object.keys(a) as (keyof ClassSettings)[]).every((key) => a[key] === b[key]);
}

export function SettingsTab({ settings, send, connected }: Props) {
  const [draft, setDraft] = useState<ClassSettings>(settings);
  const [saved, setSaved] = useState<ClassSettings>(settings);

  useEffect(() => {
    setDraft(settings);
    setSaved(settings);
  }, [settings]);

  const dirty = !sameSettings(draft, saved);

  const set = <K extends keyof ClassSettings>(key: K, value: ClassSettings[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  const save = () => {
    if (!connected) return;
    send({ type: "settings_set", settings: draft });
  };

  const numberField = (
    key: keyof ClassSettings,
    label: string,
    hint: string,
    min: number,
    max: number,
  ) => (
    <Field key={key} label={label} htmlFor={`set-${key}`} hint={hint}>
      <Input
        id={`set-${key}`}
        type="number"
        min={min}
        max={max}
        value={String(draft[key])}
        onChange={(event) => set(key, Number(event.target.value) as never)}
        className="h-10"
      />
    </Field>
  );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <CardHeader
          title="수업 설정"
          description="선생님이 이 수업의 규칙·화면·문구를 직접 바꿉니다. 점수는 서버가 이 값으로 다시 계산합니다."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDraft(saved)} disabled={!dirty}>
                되돌리기
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setDraft(DEFAULT_SETTINGS)}>
                <IconRefresh size={14} /> 기본값
              </Button>
              <Button size="sm" onClick={save} disabled={!connected || !dirty}>
                <IconCheck size={14} /> 설정 저장
              </Button>
            </div>
          }
        />
        {dirty ? (
          <Callout tone="warn" icon={<IconAlert size={15} />} className="mt-4">
            저장되지 않은 변경이 있습니다. <strong>설정 저장</strong>을 눌러야 수업에 반영됩니다.
          </Callout>
        ) : null}
        {!connected ? (
          <p className="mt-3 text-[12px] text-rose-600">실시간 연결이 끊겨 있어 지금은 저장할 수 없습니다.</p>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="점수 규칙" description="정답·오답·순위 표시를 조정합니다." />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {numberField("correctPoints", "정답 점수", "기본 100점", 0, 1000)}
            {numberField("wrongPoints", "오답 점수", "감점은 음수 (예: -20)", -500, 1000)}
            {numberField("leaderboardSize", "랭킹 표시 인원", "프로젝터 랭킹판에 보여 줄 수", 3, 50)}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <div>
                <p className="text-[12.5px] font-semibold text-slate-700">속도 가점</p>
                <p className="text-[11px] text-slate-400">속도전에서 빨리 답할수록 더 받습니다.</p>
              </div>
              <Toggle
                checked={draft.speedBonus}
                onChange={(next) => set("speedBonus", next)}
                label="속도 가점"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="문제 진행" description="새 문제를 낼 때 기본으로 채워집니다." />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {numberField("quizSeconds", "기본 제한 시간(초)", "0 = 제한 없음", 0, 3600)}
            <Field label="빠른 선택" htmlFor="set-quiz-presets" hint="자주 쓰는 시간으로 바로 맞춥니다.">
              <div className="flex flex-wrap gap-1.5">
                {[0, 15, 30, 45, 60, 90].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("quizSeconds", value)}
                    className={
                      draft.quizSeconds === value
                        ? "rounded-lg bg-brand-600 px-2.5 py-1 text-[11.5px] font-bold text-white"
                        : "rounded-lg bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 hover:bg-slate-200"
                    }
                  >
                    {value === 0 ? "무제한" : `${value}초`}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader
            title="자리·모둠"
            description="모둠·자리 탭에서 자리를 뽑을 때 이 규칙을 씁니다. 서버가 이 규칙으로 배정합니다."
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {SEAT_RULES.map((rule) => (
              <button
                key={rule.id}
                type="button"
                onClick={() => set("seatRule", rule.id)}
                className={
                  draft.seatRule === rule.id
                    ? "rounded-xl bg-brand-600 px-3 py-2 text-left text-white ring-1 ring-brand-600"
                    : "rounded-xl bg-slate-50 px-3 py-2 text-left ring-1 ring-slate-200 hover:bg-slate-100"
                }
              >
                <p className="text-[12.5px] font-bold">{rule.label}</p>
                <p
                  className={
                    draft.seatRule === rule.id ? "text-[11px] text-white/80" : "text-[11px] text-slate-400"
                  }
                >
                  {rule.hint}
                </p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="아이템전" description="아이템 효과와 보유 개수를 바꿉니다." />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {numberField("itemDoubleMultiplier", "더블 배수", "정답 점수에 곱합니다.", 2, 5)}
            {numberField("itemStealPercent", "훔치기 비율(%)", "1위 점수의 몇 %를 가져올지", 1, 50)}
            {numberField("itemBonusPoints", "+점 아이템", "즉시 더할 점수", 10, 500)}
            {numberField("itemMaxHeld", "최대 보유 개수", "학생 한 명이 들 수 있는 수", 1, 6)}
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="학생 화면 허용" description="수업 흐름에 맞게 학생 기능을 켜고 끕니다." />
          <div className="mt-3 divide-y divide-slate-100">
            {(
              [
                ["requireFullscreen", "입장 시 전체화면 요청", "수업 생성 시 설정과 함께 적용됩니다."],
                ["allowStudentShare", "화면 공유 허용", "학생이 자기 화면을 보여 줄 수 있습니다."],
                ["allowHandRaise", "손들기 허용", "학생 화면의 손들기 버튼을 보여 줍니다."],
                ["allowStudentPosts", "보드 카드 붙이기 허용", "활동 보드에 학생이 직접 카드를 붙입니다."],
                ["teamChatLocked", "모둠 대화 잠그기", "잠그면 학생이 모둠 토의에 글을 쓰지 못합니다."],
                ["showLeaderboard", "내 순위 표시", "학생 화면에 내 점수·순위를 보여 줍니다."],
                ["soundEnabled", "효과음 기본 켜기", "학생 화면 입장 시 효과음 상태입니다."],
              ] as [keyof ClassSettings, string, string][]
            ).map(([key, label, hint]) => (
              <div key={key} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-[12.5px] font-semibold text-slate-700">{label}</p>
                  <p className="text-[11px] text-slate-400">{hint}</p>
                </div>
                <Toggle
                  checked={Boolean(draft[key])}
                  onChange={(next) => set(key, next as never)}
                  label={label}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <CardHeader title="학급 표시" description="학생 화면 상단과 참가 화면에 보이는 문구입니다." />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="학급 이름" htmlFor="set-className" hint="예: 3학년 2반. 비우면 표시하지 않습니다.">
              <Input
                id="set-className"
                value={draft.className}
                maxLength={40}
                onChange={(event) => set("className", event.target.value)}
                placeholder="3학년 2반"
                className="h-10"
              />
            </Field>
            <Field label="참가 안내 문구" htmlFor="set-joinNotice" hint="학생 입장 화면에 표시됩니다.">
              <Textarea
                id="set-joinNotice"
                value={draft.joinNotice}
                maxLength={200}
                rows={3}
                onChange={(event) => set("joinNotice", event.target.value)}
                placeholder="예: 준비물은 연필과 지우개입니다."
              />
            </Field>
          </div>
          <Divider className="mt-4" />
          <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400">
            점수·제한시간·아이템 값은 서버가 계산하므로 학생이 값을 바꿔도 결과는 그대로입니다. 모둠 이름과
            자리 배치는 <strong>모둠·자리</strong> 탭에서 조정합니다.
          </p>
        </Card>
      </div>

      <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-[12px] text-slate-500">
          {dirty ? "변경 사항이 아직 적용되지 않았습니다." : "모든 변경이 수업에 적용되어 있습니다."}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDraft(saved)} disabled={!dirty}>
            되돌리기
          </Button>
          <Button size="sm" onClick={save} disabled={!connected || !dirty}>
            <IconCheck size={14} /> 설정 저장
          </Button>
        </div>
      </div>
    </div>
  );
}

