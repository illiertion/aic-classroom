/**
 * pages.dev 프록시.
 *
 * 정적 파일(React 번들)은 Cloudflare Pages가 그대로 서빙하고, `/api/*`(REST + 실시간
 * WebSocket)는 Durable Object와 D1을 가진 Worker로 넘깁니다. 브라우저 입장에서는
 * 같은 주소(same-origin)라서 쿠키·CSRF 검사·WebSocket이 모두 그대로 동작합니다.
 */
const API_ORIGIN = "https://aic.pcylove0412.workers.dev";

export async function onRequest(context: {
  request: Request;
}): Promise<Response> {
  const request = context.request;
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, API_ORIGIN);

  const headers = new Headers(request.headers);
  // Worker는 Origin과 자기 Host가 같아야 변경 요청을 허용합니다.
  headers.set("origin", API_ORIGIN);
  headers.set("x-forwarded-host", incoming.host);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const response = await fetch(target.toString(), init);

  // WebSocket 업그레이드는 소켓째로 넘깁니다.
  const socket = (response as { webSocket?: unknown }).webSocket;
  if (socket) {
    return new Response(null, { status: 101, webSocket: socket } as ResponseInit);
  }

  const proxied = new Response(response.body, response);
  // 원본과 인코딩이 달라질 수 있는 헤더는 지웁니다.
  proxied.headers.delete("content-encoding");
  proxied.headers.delete("content-length");
  return proxied;
}
