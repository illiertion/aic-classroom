import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Button, Card } from "../components/ui";
import { IconArrowLeft } from "../components/Icons";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6fb]">
      <header className="mx-auto flex h-16 w-full max-w-4xl items-center px-4">
        <Link to="/">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md p-8 text-center">
          <p className="font-mono text-[13px] font-bold tracking-[0.2em] text-brand-500">404</p>
          <h1 className="mt-2 text-[20px] font-extrabold tracking-tight text-slate-900">
            페이지를 찾을 수 없습니다
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
            주소가 바뀌었거나 참가 코드가 만료되었을 수 있습니다. 학생은 선생님께 받은 QR 또는 참가
            코드를 다시 확인해 주세요.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to="/">
              <Button>
                <IconArrowLeft size={15} /> 홈으로
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="secondary">소개</Button>
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
