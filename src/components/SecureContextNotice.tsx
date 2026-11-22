/**
 * Browsers disable crypto.subtle, navigator.clipboard and getDisplayMedia when
 * the page is opened over plain http:// on a non-loopback address. Students and
 * teachers reach the classroom through a LAN/Tailscale IP, so explain the limit
 * instead of failing silently.
 */
export function SecureContextNotice() {
  if (typeof window === "undefined" || window.isSecureContext) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex justify-center print:hidden">
      <div className="pointer-events-auto w-full max-w-xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900 shadow-lg">
        <p className="font-semibold">지금은 http:// 주소로 열려 있습니다</p>
        <p className="mt-1">
          이 주소에서는 브라우저가 <strong>화면 공유</strong>를 막습니다. 복사와 PDF 배포는 대체 방식으로
          동작합니다. 모든 기능을 쓰려면 주소창을 <strong>https://</strong> 주소(예:{" "}
          <code className="rounded bg-amber-100 px-1">https://이-PC-IP:8443</code>)로 바꿔 다시 열어 주세요.
        </p>
      </div>
    </div>
  );
}
