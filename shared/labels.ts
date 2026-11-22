import type { EventSeverity, FocusEventType, StudentLive } from "./protocol";

export interface EventMeta {
  label: string;
  severity: EventSeverity;
  /** Describe what was actually observed, not what it implies. */
  observation: string;
}

export const EVENT_META: Record<FocusEventType, EventMeta> = {
  join: { label: "수업 입장", severity: "info", observation: "수업 화면에 접속했다." },
  rejoin: { label: "수업 복귀", severity: "info", observation: "수업에 다시 접속했다." },
  leave: { label: "연결 종료", severity: "notice", observation: "브라우저가 연결 종료를 알렸다." },
  fullscreen_enter: {
    label: "전체화면 진입",
    severity: "info",
    observation: "전체화면 상태가 확인되었다.",
  },
  fullscreen_exit: {
    label: "전체화면 해제",
    severity: "warning",
    observation: "전체화면이 해제되었다. (브라우저 ESC 또는 시스템 동작)",
  },
  fullscreen_unknown: {
    label: "전체화면 확인 불가",
    severity: "info",
    observation: "브라우저가 전체화면 상태를 알려주지 않았다.",
  },
  page_hidden: {
    label: "페이지 숨김",
    severity: "warning",
    observation: "페이지가 화면에 보이지 않는 상태가 되었다.",
  },
  page_visible: {
    label: "페이지 표시",
    severity: "info",
    observation: "페이지가 다시 화면에 표시되었다.",
  },
  page_leave: {
    label: "페이지 이탈 감지",
    severity: "warning",
    observation: "페이지를 떠나는 이벤트가 발생했다.",
  },
  page_return: {
    label: "페이지 복귀",
    severity: "info",
    observation: "페이지로 돌아왔다.",
  },
  network_online: { label: "네트워크 연결", severity: "info", observation: "네트워크가 연결되었다." },
  network_offline: {
    label: "네트워크 끊김",
    severity: "warning",
    observation: "브라우저가 오프라인 상태를 보고했다.",
  },
  ws_disconnected: {
    label: "실시간 연결 끊김",
    severity: "warning",
    observation: "실시간 연결이 끊겨 현재 상태를 확인할 수 없다.",
  },
  ws_reconnected: {
    label: "실시간 연결 복구",
    severity: "info",
    observation: "실시간 연결이 다시 수립되었다.",
  },
  key_escape: {
    label: "Esc 입력 감지",
    severity: "info",
    observation: "페이지가 Esc 키 입력을 받았다. 전체화면 해제와는 별개다.",
  },
  shortcut_observed: {
    label: "단축키 입력 감지",
    severity: "info",
    observation: "페이지가 브라우저 단축키 입력을 받았다. 차단 여부는 확인되지 않는다.",
  },
  screen_share_started: {
    label: "화면 공유 시작",
    severity: "info",
    observation: "학생이 직접 허용한 화면의 공유가 시작되었다.",
  },
  screen_share_stopped: {
    label: "화면 공유 중지",
    severity: "info",
    observation: "학생이 화면 공유를 중지했다.",
  },
  screen_share_denied: {
    label: "화면 공유 미허용",
    severity: "notice",
    observation: "학생이 화면 공유 선택을 취소했거나 브라우저가 거부했다.",
  },
};

export function eventMeta(type: FocusEventType): EventMeta {
  return EVENT_META[type] ?? { label: type, severity: "info", observation: "" };
}

export function studentStatusLabel(student: StudentLive): string {
  if (!student.online) return "연결 끊김";
  if (student.fullscreen === false) return "전체화면 해제";
  if (student.visibility === "hidden") return "페이지 이탈 의심";
  return "정상 참여";
}

export function studentStatusTone(
  student: StudentLive,
): "ok" | "warn" | "danger" | "muted" {
  if (!student.online) return "danger";
  if (student.visibility === "hidden") return "warn";
  if (student.fullscreen === false) return "warn";
  return "ok";
}
