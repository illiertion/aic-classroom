import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv, Env } from "./types";
import { ApiError, notFound } from "./lib/errors";
import { readSession, TEACHER_ID } from "./lib/auth";
import { sha256Hex } from "./lib/crypto";
import { findClassroom, findParticipantByToken } from "./lib/db";
import authRoutes from "./api/auth";
import classroomRoutes from "./api/classrooms";
import joinRoutes from "./api/join";
import padletRoutes from "./api/padlet";
import { runRetention } from "./cleanup";

export { ClassroomHub } from "./do/ClassroomHub";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY");
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(self), display-capture=(self), geolocation=()",
  );
});

app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json(
      { error: { code: error.code, message: error.message } },
      error.status as ContentfulStatusCode,
    );
  }
  console.error("AIC unhandled error", error);
  return c.json(
    { error: { code: "internal_error", message: "서버에서 오류가 발생했습니다." } },
    500,
  );
});

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/classrooms", classroomRoutes);
app.route("/api/v1/join", joinRoutes);
app.route("/api/v1/padlet", padletRoutes);

/**
 * Real-time classroom socket. Authorization happens here, then the request is
 * forwarded to the classroom's Durable Object with trusted role headers.
 */
app.get("/api/v1/realtime/:classroomId", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    throw new ApiError(426, "upgrade_required", "WebSocket 연결이 필요합니다.");
  }
  const classroom = await findClassroom(c.env, c.req.param("classroomId"));
  if (!classroom) throw notFound("수업을 찾을 수 없습니다.");
  if (classroom.status !== "live") {
    throw new ApiError(409, "class_ended", "종료된 수업입니다.");
  }

  let role: "teacher" | "student" = "student";
  let participantId: string | undefined;
  let participantName: string | undefined;

  // An explicit participant token always means "student". This keeps the
  // student view usable when a teacher opens a join link in their own browser.
  const token = c.req.query("token") ?? "";
  if (token) {
    const participant = await findParticipantByToken(c.env, classroom.id, await sha256Hex(token));
    if (!participant) {
      throw new ApiError(401, "invalid_participant", "참가 정보가 만료되었습니다.");
    }
    participantId = participant.id;
    participantName = participant.name;
  } else {
    const session = await readSession(c);
    if (!session || session.tid !== TEACHER_ID || session.tid !== classroom.teacher_id) {
      throw new ApiError(401, "unauthorized", "수업 참가 정보가 없습니다.");
    }
    role = "teacher";
  }

  const stub = c.env.CLASSROOM_HUB.get(c.env.CLASSROOM_HUB.idFromName(classroom.id));
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-aic-role", role);
  headers.set("x-aic-classroom", classroom.id);
  if (participantId) headers.set("x-aic-participant", participantId);
  if (participantName) headers.set("x-aic-name", encodeURIComponent(participantName));
  return stub.fetch(new Request(c.req.url, { method: "GET", headers }));
});

app.all("/api/*", (c) =>
  c.json({ error: { code: "not_found", message: "API 경로를 찾을 수 없습니다." } }, 404),
);

// Static SPA. Assets routing (including SPA fallback) is handled by the
// Workers assets binding configured in wrangler.jsonc.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  scheduled: (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(
      runRetention(env).catch((error) => {
        console.error("AIC retention sweep failed", error);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
