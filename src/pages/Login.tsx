import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AuthLayout } from "../components/AuthLayout";
import { Button, Callout, CopyButton, Field, Input } from "../components/ui";
import { IconAlert, IconArrowRight, IconCheck, IconLock, IconUser } from "../components/Icons";


export default function Login() {
  const { teacher, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [freshCode, setFreshCode] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  useEffect(() => {
    if (teacher) navigate(from, { replace: true });
  }, [teacher, from, navigate]);

  const run = async (action: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
      await refresh();
      navigate(from, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "입장 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api.auth.loginWithCode(name.trim(), code.trim());
    });
  };

  const createAccount = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("이름을 먼저 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    void api.auth
      .register(trimmed)
      .then(async (result) => {
        setFreshCode(result.accessCode);
        await refresh();
      })
      .catch((caught) => {
        setError(caught instanceof ApiRequestError ? caught.message : "계정을 만들지 못했습니다.");
      })
      .finally(() => setLoading(false));
  };

  if (freshCode) {
    return (
      <AuthLayout
        title="계정이 만들어졌습니다"
        subtitle="이 액세스 코드를 적어 두세요. 이름과 코드로 언제든 다시 들어올 수 있습니다."
        footer={
          <span className="inline-flex items-start gap-1.5">
            <IconLock size={13} className="mt-0.5 shrink-0" />
            코드를 잊어버리면 다시 만들 수 없습니다. 대시보드에서 재발급은 가능합니다.
          </span>
        }
      >
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">액세스 코드</p>
          <p className="mt-2 font-mono text-[30px] font-extrabold tracking-[0.2em] text-brand-800">
            {freshCode}
          </p>
          <div className="mt-3 flex justify-center">
            <CopyButton value={freshCode} label="코드 복사" />
          </div>
        </div>
        <Button
          size="lg"
          className="mt-4 w-full"
          onClick={() => {
            setCode(freshCode);
            setFreshCode(null);
            void refresh().then(() => navigate(from, { replace: true }));
          }}
        >
          <IconCheck size={16} /> 이 코드로 들어가기
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="선생님 입장"
      subtitle="이름과 액세스 코드만으로 들어옵니다. 비밀번호는 없습니다. 내 수업만 보입니다."
      footer={
        <span className="inline-flex items-start gap-1.5">
          <IconLock size={13} className="mt-0.5 shrink-0" />
          액세스 코드는 Cloudflare D1에만 저장되고, 학생에게는 절대 노출되지 않습니다.
        </span>
      }
    >
    <>
      <form onSubmit={submit} className="space-y-4">
        {error ? (
          <Callout tone="danger" icon={<IconAlert size={16} />}>
            {error}
          </Callout>
        ) : null}

        <Field label="선생님 이름" htmlFor="teacher-name" hint="학생 화면에 표시되는 이름입니다.">
          <Input
            id="teacher-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 김선생"
            maxLength={40}
            autoFocus
          />
        </Field>
        <Field label="액세스 코드" htmlFor="access-code" hint="처음 만들 때 받은 6자리 코드입니다.">
          <Input
            id="access-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={12}
            className="font-mono tracking-[0.18em]"
          />
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          내 수업 열기
          <IconArrowRight size={16} />
        </Button>
        <Button
          type="button"
          size="md"
          variant="secondary"
          className="w-full"
          disabled={loading || !name.trim()}
          onClick={createAccount}
        >
          <IconUser size={15} /> 이 이름으로 새 계정 만들기
        </Button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white/70 p-4 text-[12px] leading-relaxed text-slate-500">
        학생은 로그인하지 않습니다. 학생에게는 선생님이 공유한{" "}
        <span className="font-semibold text-slate-700">참가 코드 또는 QR</span>만 필요합니다.
      </div>
      <Link to="/" className="mt-5 inline-block text-[12.5px] font-medium text-slate-500 hover:text-slate-900">
        ← 처음으로
      </Link>
    </>
    </AuthLayout>
  );
}



