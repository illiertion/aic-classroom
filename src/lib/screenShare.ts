import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  RtcCandidate,
  RtcDescription,
  RtcPurpose,
  RtcSignal,
  ServerMessage,
} from "../../shared/protocol";

/**
 * Screen capture must start inside the join click (browser user gesture), but
 * the student room mounts after navigation. The pending promise bridges that
 * moment until the classroom socket is open.
 */
let pendingStudentShare: Promise<MediaStream | null> | null = null;

export function stagePendingStudentShare(promise: Promise<MediaStream | null>): void {
  pendingStudentShare = promise;
}

export function takePendingStudentShare(): Promise<MediaStream | null> | null {
  const pending = pendingStudentShare;
  pendingStudentShare = null;
  return pending;
}

/** Screen capture needs a secure context: https:// or localhost only. */
export function displayCaptureProblem(): string | null {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "화면 공유는 https:// 주소(또는 localhost)에서만 됩니다. 지금은 http:// 주소라 브라우저가 화면 선택 창을 막았습니다.";
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    return "이 브라우저는 화면 공유를 지원하지 않습니다.";
  }
  return null;
}

export async function requestStudentDisplay(): Promise<MediaStream | null> {
  try {
    if (displayCaptureProblem()) return null;
    return await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch {
    return null;
  }
}

/** Public STUN by default. TURN can be supplied at build time for strict NATs. */
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(",").map((value) => value.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }
  return servers;
}

interface PeerHandlers {
  purpose: RtcPurpose;
  onSignal: (signal: RtcSignal) => void;
  onStream: (stream: MediaStream) => void;
  onFailed: () => void;
}

class ScreenPeer {
  private readonly pc: RTCPeerConnection;
  private readonly pending: RTCIceCandidateInit[] = [];
  private readonly remote = new MediaStream();
  private closed = false;

  constructor(private readonly handlers: PeerHandlers) {
    this.pc = new RTCPeerConnection({ iceServers: iceServers() });
    this.pc.onicecandidate = (event) => {
      if (!event.candidate || this.closed) return;
      const candidate: RtcCandidate = {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      };
      handlers.onSignal({ kind: "candidate", purpose: handlers.purpose, candidate });
    };
    this.pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        handlers.onStream(stream);
        return;
      }
      this.remote.addTrack(event.track);
      handlers.onStream(this.remote);
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === "failed") handlers.onFailed();
    };
  }

  async startWith(stream: MediaStream): Promise<void> {
    for (const track of stream.getTracks()) this.pc.addTrack(track, stream);
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.handlers.onSignal({
      kind: "offer",
      purpose: this.handlers.purpose,
      description: { type: "offer", sdp: offer.sdp ?? "" },
    });
  }

  async accept(description: RtcDescription): Promise<void> {
    await this.pc.setRemoteDescription({ type: description.type, sdp: description.sdp });
    await this.flushCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.handlers.onSignal({
      kind: "answer",
      purpose: this.handlers.purpose,
      description: { type: "answer", sdp: answer.sdp ?? "" },
    });
  }

  async acceptAnswer(description: RtcDescription): Promise<void> {
    if (this.pc.signalingState === "closed") return;
    await this.pc.setRemoteDescription({ type: description.type, sdp: description.sdp });
    await this.flushCandidates();
  }

  async addCandidate(candidate: RtcCandidate): Promise<void> {
    const init: RTCIceCandidateInit = {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    };
    if (!this.pc.remoteDescription) {
      this.pending.push(init);
      return;
    }
    try {
      await this.pc.addIceCandidate(init);
    } catch {
      /* a candidate can arrive after the connection moved on */
    }
  }

  private async flushCandidates(): Promise<void> {
    for (const candidate of this.pending.splice(0)) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {
        /* ignore stale candidates */
      }
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.pc.close();
    } catch {
      /* already closed */
    }
  }
}

export interface Classmate {
  participantId: string;
  name: string;
  online: boolean;
}

interface TeacherOptions {
  send: (message: ClientMessage) => void;
  students: Classmate[];
}

export interface TeacherScreenShare {
  sharing: boolean;
  localStream: MediaStream | null;
  remote: Record<string, MediaStream>;
  requested: Record<string, boolean>;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  requestStudent: (participantId: string) => void;
  requestAll: () => void;
  stopViewing: (participantId: string) => void;
  handleSignal: (message: Extract<ServerMessage, { type: "rtc" }>) => void;
  dismissError: () => void;
}

/**
 * Teacher side:
 * - shares the teacher's own screen to every online student (one peer each)
 * - receives a student's screen on a separate peer after the student allows it
 */
export function useTeacherScreenShare({ send, students }: TeacherOptions): TeacherScreenShare {
  const [sharing, setSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<Record<string, MediaStream>>({});
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const sendRef = useRef(send);
  sendRef.current = send;
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const localRef = useRef<MediaStream | null>(null);
  const sendPeers = useRef(new Map<string, ScreenPeer>());
  const receivePeers = useRef(new Map<string, ScreenPeer>());

  const closeSendPeer = useCallback((participantId: string) => {
    const peer = sendPeers.current.get(participantId);
    if (!peer) return;
    peer.close();
    sendPeers.current.delete(participantId);
  }, []);

  const closeReceivePeer = useCallback((participantId: string) => {
    const peer = receivePeers.current.get(participantId);
    if (peer) {
      peer.close();
      receivePeers.current.delete(participantId);
    }
    setRemote((current) => {
      if (!(participantId in current)) return current;
      const next = { ...current };
      delete next[participantId];
      return next;
    });
    setRequested((current) => {
      if (!(participantId in current)) return current;
      const next = { ...current };
      delete next[participantId];
      return next;
    });
  }, []);

  const makeSendPeer = useCallback(
    (participantId: string) => {
      const stream = localRef.current;
      if (!stream || sendPeers.current.has(participantId)) return;
      const peer = new ScreenPeer({
        purpose: "teacher-screen",
        onSignal: (signal) => sendRef.current({ type: "rtc", to: participantId, signal }),
        onStream: () => undefined,
        onFailed: () => closeSendPeer(participantId),
      });
      sendPeers.current.set(participantId, peer);
      void peer.startWith(stream).catch(() => {
        closeSendPeer(participantId);
        setError("학생 화면으로 공유를 연결하지 못했습니다.");
      });
    },
    [closeSendPeer],
  );

  const stop = useCallback(() => {
    for (const [participantId, peer] of sendPeers.current) {
      sendRef.current({
        type: "rtc",
        to: participantId,
        signal: { kind: "stop", purpose: "teacher-screen" },
      });
      peer.close();
    }
    sendPeers.current.clear();
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    setLocalStream(null);
    setSharing(false);
  }, []);

  const start = useCallback(async () => {
    if (localRef.current) return;
    const problem = displayCaptureProblem();
    if (problem) {
      setError(problem);
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } catch {
        // Some browsers reject an audio request for window/tab capture; retry video only.
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      }
      localRef.current = stream;
      setLocalStream(stream);
      setSharing(true);
      setError(null);
      for (const track of stream.getTracks()) {
        track.addEventListener("ended", () => stop());
      }
      for (const student of studentsRef.current) {
        if (student.online) makeSendPeer(student.participantId);
      }
    } catch {
      setError("화면 공유가 허용되지 않았습니다. 브라우저 선택 창에서 화면을 골라 주세요.");
    }
  }, [makeSendPeer, stop]);

  const requestStudent = useCallback((participantId: string) => {
    setRequested((current) => ({ ...current, [participantId]: true }));
    sendRef.current({
      type: "rtc",
      to: participantId,
      signal: { kind: "request", purpose: "student-screen" },
    });
  }, []);

  const requestAll = useCallback(() => {
    for (const student of studentsRef.current) {
      if (!student.online) continue;
      setRequested((current) => ({ ...current, [student.participantId]: true }));
      sendRef.current({
        type: "rtc",
        to: student.participantId,
        signal: { kind: "request", purpose: "student-screen" },
      });
    }
  }, []);

  const stopViewing = useCallback(
    (participantId: string) => {
      sendRef.current({
        type: "rtc",
        to: participantId,
        signal: { kind: "stop", purpose: "student-screen" },
      });
      closeReceivePeer(participantId);
    },
    [closeReceivePeer],
  );

  const handleSignal = useCallback(
    (message: Extract<ServerMessage, { type: "rtc" }>) => {
      const { from, signal } = message;
      if (signal.purpose === "teacher-screen") {
        // A student (re)connected or reloaded: rebuild that peer from scratch.
        if (signal.kind === "request") {
          closeSendPeer(from);
          makeSendPeer(from);
          return;
        }
        // The teacher is the offerer, so the student's answer and ICE
        // candidates must reach the matching send peer or the stream never
        // connects.
        const peer = sendPeers.current.get(from);
        if (signal.kind === "answer") {
          void peer?.acceptAnswer(signal.description).catch(() => closeSendPeer(from));
        } else if (signal.kind === "candidate") {
          void peer?.addCandidate(signal.candidate);
        } else if (signal.kind === "stop") {
          closeSendPeer(from);
        }
        return;
      }
      if (signal.purpose !== "student-screen") return;
      if (signal.kind === "offer") {
        closeReceivePeer(from);
        const peer = new ScreenPeer({
          purpose: "student-screen",
          onSignal: (reply) => sendRef.current({ type: "rtc", to: from, signal: reply }),
          onStream: (stream) => setRemote((current) => ({ ...current, [from]: stream })),
          onFailed: () => closeReceivePeer(from),
        });
        receivePeers.current.set(from, peer);
        void peer.accept(signal.description).catch(() => {
          closeReceivePeer(from);
          setError("학생 화면을 연결하지 못했습니다.");
        });
        return;
      }
      const peer = receivePeers.current.get(from);
      if (signal.kind === "answer") {
        void peer?.acceptAnswer(signal.description).catch(() => undefined);
      } else if (signal.kind === "candidate") {
        void peer?.addCandidate(signal.candidate);
      } else if (signal.kind === "stop") {
        closeReceivePeer(from);
      }
    },
    [closeReceivePeer, closeSendPeer, makeSendPeer],
  );

  // A student joining while the teacher is already sharing gets a peer too.
  useEffect(() => {
    if (!sharing) return;
    const online = new Set(students.filter((student) => student.online).map((student) => student.participantId));
    for (const participantId of online) makeSendPeer(participantId);
    for (const participantId of sendPeers.current.keys()) {
      if (!online.has(participantId)) {
        closeSendPeer(participantId);
      }
    }
  }, [students, sharing, makeSendPeer, closeSendPeer]);

  useEffect(() => {
    return () => {
      for (const peer of sendPeers.current.values()) peer.close();
      for (const peer of receivePeers.current.values()) peer.close();
      sendPeers.current.clear();
      receivePeers.current.clear();
      localRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    sharing,
    localStream,
    remote,
    requested,
    error,
    start,
    stop,
    requestStudent,
    requestAll,
    stopViewing,
    handleSignal,
    dismissError: () => setError(null),
  };
}

interface StudentOptions {
  send: (message: ClientMessage) => void;
  onEvent: (type: "screen_share_started" | "screen_share_stopped" | "screen_share_denied") => void;
}

export interface StudentScreenShare {
  teacherStream: MediaStream | null;
  sharing: boolean;
  pendingRequest: boolean;
  error: string | null;
  start: () => Promise<void>;
  startWith: (stream: MediaStream) => Promise<void>;
  stop: () => void;
  acceptRequest: () => Promise<void>;
  dismissRequest: () => void;
  handleSignal: (message: Extract<ServerMessage, { type: "rtc" }>) => void;
  dismissError: () => void;
}

/**
 * Student side: watches the teacher's shared screen and may publish its own
 * screen only after the browser picker is confirmed by the student.
 */
export function useStudentScreenShare({ send, onEvent }: StudentOptions): StudentScreenShare {
  const [teacherStream, setTeacherStream] = useState<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendRef = useRef(send);
  sendRef.current = send;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const teacherPeer = useRef<ScreenPeer | null>(null);
  const myPeer = useRef<ScreenPeer | null>(null);
  const localRef = useRef<MediaStream | null>(null);

  const closeTeacherPeer = useCallback(() => {
    teacherPeer.current?.close();
    teacherPeer.current = null;
    setTeacherStream(null);
  }, []);

  const stop = useCallback(() => {
    if (myPeer.current) {
      sendRef.current({
        type: "rtc",
        to: "teacher",
        signal: { kind: "stop", purpose: "student-screen" },
      });
      myPeer.current.close();
      myPeer.current = null;
      onEventRef.current("screen_share_stopped");
    }
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    setSharing(false);
  }, []);

  const startWith = useCallback(
    async (stream: MediaStream) => {
      if (localRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      try {
        localRef.current = stream;
        setSharing(true);
        setPendingRequest(false);
        setError(null);
        const peer = new ScreenPeer({
          purpose: "student-screen",
          onSignal: (signal) => sendRef.current({ type: "rtc", to: "teacher", signal }),
          onStream: () => undefined,
          onFailed: () => stop(),
        });
        myPeer.current = peer;
        for (const track of stream.getTracks()) {
          track.addEventListener("ended", () => stop());
        }
        await peer.startWith(stream);
        onEventRef.current("screen_share_started");
      } catch {
        stream.getTracks().forEach((track) => track.stop());
        localRef.current = null;
        setSharing(false);
        setError("화면 공유를 시작하지 못했습니다. 다시 시도해 주세요.");
        onEventRef.current("screen_share_denied");
      }
    },
    [stop],
  );

  const start = useCallback(async () => {
    if (localRef.current) return;
    const problem = displayCaptureProblem();
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      await startWith(stream);
    } catch {
      setError("화면 공유가 허용되지 않았습니다. 선생님은 화면을 볼 수 없습니다.");
      onEventRef.current("screen_share_denied");
    }
  }, [startWith]);

  const handleSignal = useCallback(
    (message: Extract<ServerMessage, { type: "rtc" }>) => {
      const { signal } = message;
      if (signal.purpose === "teacher-screen") {
        if (signal.kind === "offer") {
          closeTeacherPeer();
          const peer = new ScreenPeer({
            purpose: "teacher-screen",
            onSignal: (reply) => sendRef.current({ type: "rtc", to: "teacher", signal: reply }),
            onStream: (stream) => setTeacherStream(stream),
            onFailed: () => closeTeacherPeer(),
          });
          teacherPeer.current = peer;
          void peer.accept(signal.description).catch(() => {
            closeTeacherPeer();
            setError("선생님 화면을 받지 못했습니다.");
          });
        } else if (signal.kind === "candidate") {
          void teacherPeer.current?.addCandidate(signal.candidate);
        } else if (signal.kind === "stop") {
          closeTeacherPeer();
        }
        return;
      }

      if (signal.purpose === "student-screen") {
        if (signal.kind === "answer") {
          void myPeer.current?.acceptAnswer(signal.description).catch(() => undefined);
        } else if (signal.kind === "candidate") {
          void myPeer.current?.addCandidate(signal.candidate);
        } else if (signal.kind === "request") {
          setPendingRequest(true);
        } else if (signal.kind === "stop") {
          if (myPeer.current) stop();
        }
      }
    },
    [closeTeacherPeer, stop],
  );

  const acceptRequest = useCallback(async () => {
    setPendingRequest(false);
    await start();
  }, [start]);

  useEffect(() => {
    return () => {
      teacherPeer.current?.close();
      myPeer.current?.close();
      localRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    teacherStream,
    sharing,
    pendingRequest,
    error,
    start,
    startWith,
    stop,
    acceptRequest,
    dismissRequest: () => setPendingRequest(false),
    handleSignal,
    dismissError: () => setError(null),
  };
}
