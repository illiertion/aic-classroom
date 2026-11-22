import type { SharedMaterial } from "../../shared/protocol";
import { MAX_MATERIAL_BYTES } from "../../shared/protocol";

/**
 * Worksheet PDFs are kept only in the teacher's browser. They are streamed to
 * students over the classroom socket while the teacher's console is open; no
 * copy is written to D1, R2 or any other server storage.
 */
export interface StoredMaterial extends SharedMaterial {
  blob: Blob;
  createdAt: number;
}

const DB_NAME = "aic-local";
const DB_VERSION = 1;
const STORE = "materials";

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("이 브라우저는 로컬 저장소(IndexedDB)를 지원하지 않습니다."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("boards")) db.createObjectStore("boards", { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("로컬 저장소를 열지 못했습니다."));
    });
  }
  return databasePromise;
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = action(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("자료 저장에 실패했습니다."));
      }),
  );
}

function fallbackHash(bytes: Uint8Array): string {
  let a = 0x811c9dc5;
  let b = 0xc2b2ae35;
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    a = Math.imul(a ^ byte, 0x01000193) >>> 0;
    b = Math.imul(b ^ byte, 0x85ebca6b) >>> 0;
  }
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}

async function digestHex(buffer: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest("SHA-256", buffer);
      return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      /* fall through: http:// LAN 주소는 보안 컨텍스트가 아니어서 crypto.subtle 이 없습니다. */
    }
  }
  return fallbackHash(new Uint8Array(buffer));
}

export async function saveMaterial(file: File): Promise<{ meta: SharedMaterial; blob: Blob }> {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("PDF 파일만 학습지로 배포할 수 있습니다.");
  }
  if (file.size <= 0) throw new Error("빈 파일은 배포할 수 없습니다.");
  if (file.size > MAX_MATERIAL_BYTES) {
    const mb = Math.round(MAX_MATERIAL_BYTES / (1024 * 1024));
    throw new Error(`학습지 PDF는 ${mb}MB 이하만 배포할 수 있습니다.`);
  }
  const buffer = await file.arrayBuffer();
  const meta: SharedMaterial = {
    id: `mat_${Date.now().toString(36)}_${await digestHex(buffer)}`,
    name: file.name.slice(0, 160),
    mime: "application/pdf",
    size: file.size,
    kind: "pdf",
  };
  const stored: StoredMaterial = { ...meta, blob: file, createdAt: Date.now() };
  await run("readwrite", (store) => store.put(stored));
  return { meta, blob: file };
}

export async function loadMaterial(id: string): Promise<StoredMaterial | null> {
  const row = await run<StoredMaterial | undefined>("readonly", (store) => store.get(id));
  return row ?? null;
}

export async function listMaterials(): Promise<SharedMaterial[]> {
  const rows = await run<StoredMaterial[]>("readonly", (store) => store.getAll());
  return rows
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ blob: _blob, createdAt: _createdAt, ...meta }) => meta);
}

export async function deleteMaterial(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}
