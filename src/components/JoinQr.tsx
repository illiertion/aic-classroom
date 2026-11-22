import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { IconQr } from "./Icons";
import { Skeleton } from "./ui";

export function JoinQr({ value, size = 240 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSrc(null);
    setFailed(false);
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1220", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (failed) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400"
        style={{ width: size, height: size }}
      >
        <IconQr size={32} />
        <span className="text-[12px]">QR을 만들지 못했습니다</span>
      </div>
    );
  }
  if (!src) return <Skeleton className="rounded-2xl" />;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="수업 참가 QR 코드"
      className="rounded-2xl border border-slate-200 bg-white p-2"
      style={{ width: size, height: size }}
    />
  );
}
