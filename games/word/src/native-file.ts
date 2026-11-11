import { type GameState, replayRun } from './game';

const MAX_FILE_BYTES = 16 * 1024 * 1024;
export type NativeFile = { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };
export type AcceptedNativeFile = {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
  sha256: string;
  original: unknown;
  state: GameState;
};

/** File mode owns only these in-memory bytes. Replay owns complete state validation. */
export class NativeFileSelection {
  private generation = 0;

  cancel(): void {
    this.generation++;
  }

  async read(file: NativeFile): Promise<AcceptedNativeFile | null> {
    const generation = ++this.generation;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('Choose a file no larger than 16 MiB.');
      const buffer = await file.arrayBuffer();
      if (generation !== this.generation) return null;
      if (buffer.byteLength > MAX_FILE_BYTES) throw new Error('Choose a file no larger than 16 MiB.');
      const bytes = new Uint8Array(buffer);
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch {
        throw new Error('This file is not valid UTF-8 text. Choose a His Word export.');
      }
      if (text.startsWith('\uFEFF')) text = text.slice(1);
      let original: unknown;
      let state: GameState;
      try {
        original = JSON.parse(text);
        state = replayRun(original);
      } catch {
        throw new Error('This export could not be replayed. Choose a current His Word export.');
      }
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      if (generation !== this.generation) return null;
      const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
      );
      return { name: file.name, bytes, sha256, original, state };
    } catch (error) {
      if (generation !== this.generation) return null;
      throw error;
    }
  }
}
