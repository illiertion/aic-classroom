import type { ClientMessage, SharedMaterial } from "../../shared/protocol";
import { FILE_CHUNK_BASE64 } from "../../shared/protocol";

const RAW_CHUNK_BYTES = Math.floor((FILE_CHUNK_BASE64 * 3) / 4);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export interface SendFileOptions {
  to: string;
  material: SharedMaterial;
  blob: Blob;
  send: (message: ClientMessage) => void;
  onProgress?: (sent: number, total: number) => void;
}

/**
 * Relay a worksheet PDF from the teacher's browser to one student through the
 * classroom socket. Nothing is stored server-side; chunks are forwarded.
 */
export async function relayFileToStudent({
  to,
  material,
  blob,
  send,
  onProgress,
}: SendFileOptions): Promise<void> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const total = Math.max(1, Math.ceil(buffer.byteLength / RAW_CHUNK_BYTES));
  const transferId = `xfer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  for (let index = 0; index < total; index += 1) {
    const slice = buffer.subarray(index * RAW_CHUNK_BYTES, (index + 1) * RAW_CHUNK_BYTES);
    send({
      type: "file_chunk",
      to,
      transferId,
      materialId: material.id,
      name: material.name,
      mime: "application/pdf",
      size: buffer.byteLength,
      index,
      total,
      data: bytesToBase64(slice),
    });
    onProgress?.(index + 1, total);
    // Yield so the socket and UI stay responsive for large PDFs.
    if (index % 4 === 3) await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
}

export interface IncomingTransfer {
  transferId: string;
  name: string;
  mime: string;
  size: number;
  total: number;
  chunks: Uint8Array[];
  received: number;
}

export function createTransferBuffer(message: {
  transferId: string;
  name: string;
  mime: string;
  size: number;
  total: number;
}): IncomingTransfer {
  return {
    transferId: message.transferId,
    name: message.name,
    mime: message.mime,
    size: message.size,
    total: message.total,
    chunks: [],
    received: 0,
  };
}

export function addChunk(
  transfer: IncomingTransfer,
  index: number,
  data: string,
): { done: boolean; progress: number } {
  if (index >= 0 && index < transfer.total && transfer.chunks[index] === undefined) {
    transfer.chunks[index] = base64ToBytes(data);
  }
  transfer.received = transfer.chunks.filter(Boolean).length;
  const done = transfer.received === transfer.total;
  return { done, progress: transfer.total === 0 ? 0 : transfer.received / transfer.total };
}

export function finishTransfer(transfer: IncomingTransfer): Blob {
  const totalBytes = transfer.chunks.reduce((sum, chunk) => sum + (chunk?.byteLength ?? 0), 0);
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of transfer.chunks) {
    if (!chunk) continue;
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Blob([merged], { type: transfer.mime || "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
