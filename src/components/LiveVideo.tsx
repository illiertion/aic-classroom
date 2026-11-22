import { useEffect, useRef } from "react";

export function LiveVideo({
  stream,
  muted = false,
  className,
  label,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  if (!stream) return null;

  return (
    <div className={className}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        aria-label={label}
        className="h-full w-full bg-slate-950 object-contain"
      />
    </div>
  );
}
