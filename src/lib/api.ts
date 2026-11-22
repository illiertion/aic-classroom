import type {
  ClassroomEventRecord,
  ClassroomSettings,
  ClassroomSnapshot,
  ClassroomSummary,
  ClassroomPublicInfo,
  JoinResult,
  PadletResolved,
  StudentSnapshot,
  TeacherProfile,
} from "../../shared/protocol";

const API_BASE = "/api/v1";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface RequestOptions extends RequestInit {
  token?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("x-aic-client", "web");
  if (token) headers.set("x-aic-participant", token);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const error = data as { error?: { message?: string; code?: string } } | null;
    throw new ApiRequestError(
      error?.error?.message ?? `요청에 실패했습니다. (${response.status})`,
      response.status,
      error?.error?.code ?? "request_failed",
    );
  }
  return data as T;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const api = {
  auth: {
    me: () => request<{ teacher: TeacherProfile }>("/auth/me"),
    login: (password: string) =>
      request<{ teacher: TeacherProfile }>("/auth/login", { method: "POST", ...json({ password }) }),
    logout: () => request<{ ok: true }>("/auth/logout", { method: "POST", ...json({}) }),
    updateProfile: (name: string) =>
      request<{ teacher: TeacherProfile }>("/auth/profile", { method: "PATCH", ...json({ name }) }),
  },

  classrooms: {
    list: () => request<{ classrooms: ClassroomSummary[] }>("/classrooms"),
    create: (title: string, subject: string) =>
      request<{ classroom: ClassroomSummary }>("/classrooms", { method: "POST", ...json({ title, subject }) }),
    get: (id: string) => request<{ classroom: ClassroomSummary }>(`/classrooms/${id}`),
    update: (
      id: string,
      patch: Partial<ClassroomSettings> & { title?: string; subject?: string },
    ) => request<{ classroom: ClassroomSummary }>(`/classrooms/${id}`, { method: "PATCH", ...json(patch) }),
    start: (id: string) =>
      request<{ classroom: ClassroomSummary }>(`/classrooms/${id}/start`, { method: "POST", ...json({}) }),
    end: (id: string) =>
      request<{ classroom: ClassroomSummary }>(`/classrooms/${id}/end`, { method: "POST", ...json({}) }),
    remove: (id: string) => request<{ ok: true }>(`/classrooms/${id}`, { method: "DELETE" }),
    state: (id: string) => request<{ snapshot: ClassroomSnapshot }>(`/classrooms/${id}/state`),
    events: (id: string, participantId?: string, limit = 100) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (participantId) params.set("participantId", participantId);
      return request<{ events: ClassroomEventRecord[] }>(`/classrooms/${id}/events?${params}`);
    },
  },

  join: {
    info: (code: string) => request<{ classroom: ClassroomPublicInfo }>(`/join/${code}`),
    submit: (code: string, payload: { name?: string; token?: string }) =>
      request<JoinResult>(`/join/${code}`, { method: "POST", ...json(payload) }),
    state: (code: string, token: string) =>
      request<{ snapshot: StudentSnapshot }>(`/join/${code}/state`, { token }),
    leave: (code: string, token: string) =>
      request<{ ok: true }>(`/join/${code}/leave`, { method: "POST", token, ...json({}) }),
  },

  padlet: {
    resolve: (url: string) =>
      request<{ padlet: PadletResolved }>("/padlet/resolve", {
        method: "POST",
        ...json({ url }),
      }),
  },
};

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
