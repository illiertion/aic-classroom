import { useState } from "react";
import type { ClientMessage, PadletResolved } from "../../../shared/protocol";
import { api, ApiRequestError } from "../../lib/api";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Field,
  Textarea,
} from "../../components/ui";
import {
  IconAlert,
  IconCast,
  IconExternal,
  IconInfo,
  IconLayout,
  IconRefresh,
  IconSparkles,
} from "../../components/Icons";

const STORAGE_KEY = "aic:padlet:v2";
const LEGACY_STORAGE_KEY = "aic:padlet-embed:v1";

interface SavedPadlet extends PadletResolved {
  savedAt: number;
}

function isPadletUrl(value: string): boolean {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "") === "padlet.com";
  } catch {
    return false;
  }
}

function readSaved(): SavedPadlet | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedPadlet>;
      if (
        typeof parsed.embedUrl === "string" &&
        typeof parsed.sourceUrl === "string" &&
        isPadletUrl(parsed.embedUrl)
      ) {
        return {
          sourceUrl: parsed.sourceUrl,
          embedUrl: parsed.embedUrl,
          title: typeof parsed.title === "string" ? parsed.title : null,
          savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
        };
      }
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && isPadletUrl(legacy)) {
      return { sourceUrl: legacy, embedUrl: legacy, title: null, savedAt: Date.now() };
    }
  } catch {
    /* localStorage may be unavailable */
  }
  return null;
}

/**
 * Padlet only renders inside an iframe through its /embed URL. The teacher can
 * paste the normal padlet.com link, an embed URL, or the whole iframe code;
 * the Worker resolves the public board key without copying its contents.
 */
export function PadletTab({
  send,
  connected,
}: {
  send: (message: ClientMessage) => void;
  connected: boolean;
}) {
  const [saved, setSaved] = useState<SavedPadlet | null>(readSaved);
  const [draft, setDraft] = useState(saved?.embedUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const persist = (value: SavedPadlet | null) => {
    try {
      if (value) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch {
      setError("이 브라우저에 Padlet 주소를 저장하지 못했습니다.");
    }
  };

  const importPadlet = async () => {
    const value = draft.trim();
    if (!value) {
      setError("Padlet 주소나 embed 코드를 붙여 넣어 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { padlet } = await api.padlet.resolve(value);
      const next: SavedPadlet = { ...padlet, savedAt: Date.now() };
      setSaved(next);
      setDraft(next.embedUrl);
      persist(next);
      setNotice(
        next.title
          ? `“${next.title}” Padlet을 가져왔습니다.`
          : "Padlet을 가져왔습니다. 아래 화면에서 바로 사용할 수 있습니다.",
      );
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : "Padlet 주소를 가져오지 못했습니다. 주소를 확인해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setDraft("");
    setSaved(null);
    setNotice(null);
    setError(null);
    persist(null);
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <CardHeader
            title="패들렛 탭"
            description="padlet.com 주소를 그대로 붙여 넣으면 공개 보드의 embed 주소를 찾아 AIC 안에 띄웁니다."
            action={
              <Badge tone={saved ? "ok" : "neutral"} dot={Boolean(saved)}>
                {saved ? "연결됨" : "주소 없음"}
              </Badge>
            }
          />
        </div>
        <div className="space-y-3 p-5">
          <Field
            label="Padlet 주소 또는 embed 코드"
            htmlFor="padlet-url"
            hint="예: https://padlet.com/선생님/보드이름, https://padlet.com/embed/..., 또는 Padlet의 Embed 코드 전체. 공개 보드만 가져올 수 있습니다."
          >
            <Textarea
              id="padlet-url"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="https://padlet.com/..."
              rows={2}
              className="min-h-[64px] font-mono text-[12px]"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void importPadlet()} loading={loading}>
              <IconSparkles size={14} /> Padlet 가져오기
            </Button>
            {saved ? (
              <>
                <Button
                  variant="subtle"
                  disabled={!connected}
                  onClick={() =>
                    send({
                      type: "stage_set",
                      kind: "url",
                      title: saved.title ?? "패들렛",
                      url: saved.embedUrl,
                      requireFullscreen: true,
                    })
                  }
                >
                  <IconCast size={14} /> 학생에게 띄우기
                </Button>
                <a
                  href={saved.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <IconExternal size={13} /> 원본 Padlet
                </a>
                <Button variant="secondary" onClick={clear}>
                  지우기
                </Button>
              </>
            ) : null}
          </div>

          {error ? (
            <Callout tone="danger" icon={<IconAlert size={15} />}>
              {error}
            </Callout>
          ) : null}

          {notice ? (
            <Callout tone="brand" icon={<IconSparkles size={15} />}>
              {notice}
            </Callout>
          ) : null}

          {saved ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3.5 py-2">
                <p className="truncate text-[11.5px] font-semibold text-slate-600">
                  {saved.title ?? "Padlet 보드"}
                </p>
                <span className="text-[10px] text-slate-400">
                  padlet.com/embed · “학생에게 띄우기”로 전체 학생 화면에 표시
                </span>
              </div>
              <iframe
                src={saved.embedUrl}
                title={saved.title ?? "Padlet"}
                className="h-[560px] w-full bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
                allow="camera; microphone; fullscreen; display-capture; clipboard-write"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
              <IconLayout size={26} className="text-slate-300" />
              <p className="mt-2 text-[12.5px] font-semibold text-slate-600">
                Padlet 주소를 붙여 넣어 주세요
              </p>
              <p className="mt-1 max-w-md text-[11px] leading-relaxed text-slate-400">
                일반 padlet.com 주소, embed 주소, iframe 코드 모두 사용할 수 있습니다. 가져온
                뒤 수업 중 Padlet을 오가며 사용할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Callout tone="info" icon={<IconInfo size={15} />} title="가져오기가 안 될 때">
        비공개·암호·로그인 필요 보드는 가져올 수 없습니다. Padlet의 공유 → Embed에서 복사한
        주소를 붙여 넣어 보세요. Padlet이 iframe 표시를 막는 보드는 원본 Padlet을 새 창으로
        열어 사용하면 되고, AIC의 수업·화면 공유는 그대로 이어집니다.
        {saved ? (
          <a
            href={saved.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:text-brand-800"
          >
            <IconRefresh size={13} /> Padlet 새 창으로 열기
          </a>
        ) : null}
      </Callout>
    </div>
  );
}
