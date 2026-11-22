import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiRequestError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AuthLayout } from "../components/AuthLayout";
import { Button, Callout, Field, Input } from "../components/ui";
import { IconAlert, IconArrowRight, IconLock } from "../components/Icons";

export default function Login() {
  const { teacher, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  useEffect(() => {
    if (teacher) navigate(from, { replace: true });
  }, [teacher, from, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.auth.login(password);
      await refresh();
      navigate(from, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ? caught.message : "입장 중 문제가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="선생님 입장"
      subtitle="계정 없이 선생님 비밀번호 하나로 수업을 엽니다. 비밀번호는 Cloudflare에만 보관됩니다."
      footer={
        <span className="inline-flex items-start gap-1.5">
          <IconLock size={13} className="mt-0.5 shrink-0" />
          비밀번호는 앱 코드나 데이터베이스에 저장되지 않습니다. Cloudflare의 TEACHER_PASSWORD
          secret으로만 확인합니다.
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? (
          <Callout tone="danger" icon={<IconAlert size={16} />}>
            {error}
          </Callout>
        ) : null}
        <Field
          label="선생님 비밀번호"
          htmlFor="password"
          hint="학교에서 정한 비밀번호를 입력하세요. 학생은 이 화면을 사용하지 않습니다."
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={200}
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
          />
        </Field>
        <Button type="submit" size="lg" loading={loading} className="w-full">
          수업 열기
          <IconArrowRight size={16} />
        </Button>
      </form>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white/70 p-4 text-[12px] leading-relaxed text-slate-500">
        학생은 로그인하지 않습니다. 학생에게는 선생님이 공유한{" "}
        <span className="font-semibold text-slate-700">참가 코드 또는 QR</span>만 필요합니다.
      </div>
      <Link to="/" className="mt-5 inline-block text-[12.5px] font-medium text-slate-500 hover:text-slate-900">
        ← 처음으로
      </Link>
    </AuthLayout>
  );
}
