export interface StoredStudent {
  token: string;
  participantId: string;
  name: string;
  joinedAt: number;
}

const keyFor = (joinCode: string) => `aic.student.${joinCode.trim().toUpperCase()}`;

export function loadStudent(joinCode: string): StoredStudent | null {
  try {
    const raw = localStorage.getItem(keyFor(joinCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredStudent;
    if (!parsed?.token || !parsed?.participantId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStudent(joinCode: string, student: StoredStudent): void {
  try {
    localStorage.setItem(keyFor(joinCode), JSON.stringify(student));
  } catch {
    /* private mode / storage full: the session still works for this tab */
  }
}

export function clearStudent(joinCode: string): void {
  try {
    localStorage.removeItem(keyFor(joinCode));
  } catch {
    /* ignore */
  }
}

/** Keeps the temporary name only for this classroom; no cross-class profile. */
export function lastStudentName(): string {
  try {
    return localStorage.getItem("aic.student.lastName") ?? "";
  } catch {
    return "";
  }
}

export function rememberStudentName(name: string): void {
  try {
    localStorage.setItem("aic.student.lastName", name);
  } catch {
    /* ignore */
  }
}
