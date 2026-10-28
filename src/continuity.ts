import { snapshot } from '@adam0white/human-framework';
import {
  anchorPersonaLife,
  canonicalCast,
  claimCastChapterBatch,
  closePersonaBranch,
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  personaChannel,
  validatePersona,
  watchPersonaCheckpoint,
} from '@adam0white/lab-client';
import { admitWorkshop, CAST, CAST_IDS, type CastChapter, workshopTransfer } from './game/cast';
import { createGame } from './game/engine';
import { loadGame, saveGame } from './game/persistence';
import type { GameState } from './game/types';
import { lab } from './lab';
import { pauseForDeparture, resumeForPlay } from './ui/chapter';

export const LOCAL_KEY = 'small-works-cast-local-v2';
export const OUTCOME_LOCAL_KEY = 'small-works-cast-outcomes-v1';
export const workshopSaveKey = (state: GameState) =>
  state.castOutcomes ? OUTCOME_LOCAL_KEY : LOCAL_KEY;
interface LocalMeta {
  runId: string;
  fileSources: unknown[];
  heads: PersonaEnvelope[];
  fileOrigin: boolean;
}
const source = () => ({
  game: 'repair',
  build: String(lab.build().c ?? 'local'),
  engine: '2.23.0',
  rules: 'canonical-workshop-2',
});
/** One source of ownership and recording permission. Local receipts never replace initial replay actors. */
export class WorkshopContinuity {
  readonly fileSession = typeof location !== 'undefined' && /^\/file\/?$/.test(location.pathname);
  readonly shelf = this.fileSession ? undefined : personaChannel();
  generation = 0;
  heads: PersonaEnvelope[] = [];
  fileOrigin = false;
  loaded = false;
  busy = false;
  status = 'Saving character history across games in this browser is separate from lab recording.';
  private pendingLocal: LocalMeta | null = null;
  private state: (() => GameState) | null = null;
  private changed: () => void = () => {};
  private started = false;
  private update: ((state: GameState) => void) | null = null;
  private departure: Promise<void> | null = null;
  runId = crypto.randomUUID();
  fileSources: unknown[] = [];
  recordAfterStart = false;
  get isStarted() {
    return this.started;
  }
  private recordingKey = `workshop:${crypto.randomUUID()}`;
  constructor() {
    const invalidate = () => {
      this.generation++;
      this.recordingKey = `workshop:${crypto.randomUUID()}`;
      lab.setPersonaRecording('invalidated-workshop-history');
      this.changed();
    };
    window.addEventListener('storage', (event) => {
      if (
        event.key === null ||
        (!event.key.startsWith('hf-lab-') && !event.key.startsWith('hf-persona-recording:'))
      )
        invalidate();
    });
    window.addEventListener('hf-persona-preference', invalidate);
  }
  bind(state: () => GameState, changed: () => void, update?: (state: GameState) => void) {
    this.state = state;
    this.changed = changed;
    this.update = update ?? null;
    return watchPersonaCheckpoint(() => this.depart());
  }
  /** Menu navigation awaits this; browser close is best effort and keeps a paused local save. */
  depart(): Promise<void> {
    if (!this.departure) {
      this.departure = this.pauseAndCheckpoint().finally(() => {
        this.departure = null;
      });
    }
    return this.departure;
  }
  private async pauseAndCheckpoint() {
    const current = this.state?.();
    if (!this.started || !current?.inputs?.length || !this.update) return;
    const paused = pauseForDeparture(current);
    this.update(paused);
    this.persist(paused, false);
    if (!this.fileSession) await this.checkpointAll();
  }
  async enter(state: GameState): Promise<GameState> {
    await this.departure;
    await this.resume();
    // Retry a departure interrupted by browser close before continuing the same pinned chapter.
    if (state.chapterPaused && !this.fileSession) await this.checkpointAll();
    return resumeForPlay(state);
  }
  loadLocal(text: string): GameState {
    if (this.fileSession) throw new Error('A file session cannot open this browser’s workshop.');
    lab.setPersonaRecording('loading-workshop-history');
    this.generation++;
    const saved = JSON.parse(text);
    const state = loadGame(saved.state);
    if (!saved.started) throw new Error('This preview was saved before play started.');
    if (
      !saved.continuity ||
      !Array.isArray(saved.continuity.heads) ||
      typeof saved.continuity.fileOrigin !== 'boolean'
    )
      throw new Error('The saved character history records are invalid.');
    if (
      typeof saved.continuity.runId !== 'string' ||
      !Array.isArray(saved.continuity.fileSources) ||
      JSON.stringify(saved.continuity.fileSources).length > 1_000_000
    )
      throw new Error('The saved source archive is invalid.');
    this.runId = saved.continuity.runId;
    this.fileSources = saved.continuity.fileSources;
    this.pendingLocal = saved.continuity;
    this.fileOrigin = saved.continuity.fileOrigin;
    this.loaded = true;
    return state;
  }
  localSave(state: GameState) {
    return JSON.stringify({
      state: saveGame(state),
      started: this.started,
      continuity: {
        runId: this.runId,
        fileSources: this.fileSources,
        heads: this.pendingLocal?.heads ?? this.heads,
        fileOrigin: this.fileOrigin,
      },
    });
  }
  async resume() {
    const generation = ++this.generation;
    this.recordingKey = `workshop:${crypto.randomUUID()}`;
    lab.setPersonaRecording('restoring-local-history');
    if (this.pendingLocal) {
      const heads = await Promise.all(this.pendingLocal.heads.map((p) => validatePersona(p)));
      if (generation !== this.generation)
        throw new Error('The identity or game changed while the saved game was being restored.');
      if (
        heads.some((p) => !CAST.some((c) => c.castId === p.castId)) ||
        new Set(heads.map((p) => p.castId)).size !== heads.length
      )
        throw new Error('The saved list of character owners is invalid.');
      this.heads = heads;
      this.pendingLocal = null;
    }
    this.started = true;
    await this.recording(false);
  }
  async fresh(seed: number) {
    const shelf = this.shelf;
    if (!shelf) throw new Error('Starting a new workshop is unavailable in a file session.');
    if (this.busy) throw new Error('A chapter is already being prepared.');
    this.busy = true;
    this.recordingKey = `workshop:${crypto.randomUUID()}`;
    const generation = ++this.generation;
    lab.setPersonaRecording('preparing-whole-cast');
    try {
      await shelf.ready;
      // Owner direction 2026-10-27: same-person carryover is automatic for fresh ordinary play.
      // Existing pinned chapters keep their history; imported files use the separate file session.
      if (!shelf.enabled) {
        shelf.setEnabled(true);
        await shelf.ready;
      }
      if (generation !== this.generation) throw new Error('The game changed. Choose again.');
      const base = createGame(seed);
      let state = base;
      let chapter: CastChapter | undefined;
      let shelfUnavailable = false;
      if (shelf.enabled) {
        let result: Awaited<ReturnType<typeof claimCastChapterBatch<GameState['people']>>>;
        let prepared = false;
        const bridge = {
          request: async <T>(request: Parameters<typeof shelf.request>[0]): Promise<T> => {
            const reply = await shelf.request<T>(request);
            if (request.action === 'prepareBatch') prepared = true;
            return reply;
          },
        };
        try {
          result = await claimCastChapterBatch(
            bridge,
            CAST.map((c) => c.castId),
            source(),
            async (inputs) => {
              const people = structuredClone(base.people);
              for (const input of inputs) {
                const id = Object.keys(CAST_IDS).find((id) => CAST_IDS[id] === input.parent.castId);
                const opening = id ? people[id] : undefined;
                if (!id || !opening)
                  throw new Error('This character is not assigned to the workshop.');
                people[id] = admitWorkshop(input, opening);
              }
              return people;
            },
            { isCurrent: () => generation === this.generation },
          );
        } catch (error) {
          // Only a failed read may fall back. A lost write reply may already have committed ownership.
          const message = error instanceof Error ? error.message : String(error);
          if (
            prepared ||
            ![
              'Continuity is local to this game. Use a file.',
              'Shelf unavailable. Use a local file.',
            ].includes(message)
          )
            throw error;
          shelfUnavailable = true;
          result = null;
        }
        if (result) {
          chapter = { version: 'workshop-cast/1', inputs: result.inputs, claims: result.claims };
          state = createGame(seed, 'current', result.initial, chapter);
        }
      }
      if (generation !== this.generation)
        throw new Error('The identity or game changed. The chapter did not start.');
      this.runId = crypto.randomUUID();
      this.fileSources = [];
      this.heads = chapter?.claims ?? [];
      this.fileOrigin = false;
      this.pendingLocal = null;
      this.loaded = true;
      this.started = true;
      this.recordAfterStart = true;
      if (generation !== this.generation)
        throw new Error('The identity or game changed before the chapter started.');
      this.status = shelfUnavailable
        ? 'Your workshop is saved on this device. Shared character history is unavailable here.'
        : chapter
          ? `The chapter loaded all ${chapter.inputs.length} saved character histories together. Other characters start with their original histories.`
          : 'You started a fresh chapter. There were no saved character histories to load.';
      return state;
    } finally {
      this.busy = false;
      this.changed();
    }
  }
  async importFile(text: string) {
    const generation = ++this.generation;
    const importedSources = JSON.parse(text).castSources;
    if (
      importedSources !== undefined &&
      (!Array.isArray(importedSources) ||
        JSON.stringify(importedSources).length > 1_000_000 ||
        (this.fileSession && importedSources.length > 0))
    )
      throw new Error(
        'This file has unsupported source archives. Keep the complete original file.',
      );
    const state = loadGame(text);
    await Promise.all(
      [
        ...(state.castChapter?.claims ?? []),
        ...(state.castChapter?.inputs.map((i) => i.parent) ?? []),
      ].map((p) => validatePersona(p)),
    );
    if (generation !== this.generation)
      throw new Error('The game changed while the file was being checked.');
    this.recordingKey = `workshop:${crypto.randomUUID()}`;
    lab.setPersonaRecording(this.recordingKey);
    this.runId = crypto.randomUUID();
    this.fileSources = importedSources ?? [];
    this.heads = [];
    this.pendingLocal = null;
    this.fileOrigin = true;
    this.loaded = true;
    this.started = true;
    this.recordAfterStart = false;
    this.status =
      'When recording is on, recorded play from this file links to play in other games on this device. Character ownership records in the file do not grant ownership.';
    this.changed();
    return state;
  }
  async recording(_allow: boolean) {
    lab.setPersonaRecording(this.recordingKey);
    lab.allowPersonaRecording(true);
  }
  denyRecording() {
    // Compatibility only. Recording is controlled by the menu switch.
  }

  async checkpoint(id: string, fork = false) {
    const shelf = this.shelf;
    if (!shelf)
      throw new Error(
        'Saving or forking shared character history is unavailable in a file session.',
      );
    const state = this.state?.();
    if (!state || !this.started || !state.inputs?.length || !state.chapterPaused)
      throw new Error('Play, then pause this chapter for departure before saving a person.');
    const generation = this.generation;
    const runId = this.runId;
    const current = () => generation === this.generation && this.state?.() === state;
    await shelf.ready;
    if (!current()) throw new Error('The game changed before the character could be saved.');
    if (!shelf.enabled)
      throw new Error('Turn on character history across games in this browser first.');
    const person = state.people[id];
    const castId = CAST_IDS[id];
    if (!person || !castId) throw new Error('This character is not assigned to the workshop.');
    const parent = this.heads.find((p) => p.castId === castId);
    let envelope: PersonaEnvelope;
    if (!person.body.alive) {
      if (!parent) throw new Error('You do not own a character history that can be closed.');
      envelope = await closePersonaBranch(parent, source(), state.now);
    } else {
      const captured = await workshopTransfer(person);
      const branchId = fork ? crypto.randomUUID() : (parent?.branchId ?? crypto.randomUUID());
      const oldLife = !fork ? parent?.transfer.life : undefined;
      const life = oldLife
        ? anchorPersonaLife(oldLife as Parameters<typeof anchorPersonaLife>[0], castId, Date.now())
        : initialPersonaLife(castId, branchId, Date.now());
      envelope = await createPersona({
        format: 'hf-persona/1',
        castId,
        castRevision: canonicalCast(castId).revision,
        branchId,
        parentRevision: fork ? null : (parent?.revision ?? null),
        source: source(),
        transfer: { ...captured.transfer, life },
        limitations: captured.limitations,
      });
      // Raw snapshots stay only in a bounded source-local journal, never sent to shelf/telemetry.
      const key = 'small-works-source-journal-v2';
      let journal: unknown[] = [];
      try {
        journal = JSON.parse(localStorage.getItem(key) ?? '[]');
      } catch {}
      const row = {
        runId,
        revision: envelope.revision,
        source: source(),
        snapshot: snapshot(person),
      };
      journal.push(row);
      while (JSON.stringify(journal).length > 1_000_000) journal.shift();
      localStorage.setItem(key, JSON.stringify(journal));
    }
    if (!current()) throw new Error('The game changed before the character could be saved.');
    await shelf.request({
      action: 'put',
      envelope,
      fork,
      authored: !fork && !parent && !this.fileOrigin && !state.castChapter?.inputs.length,
    });
    if (!current()) return;
    this.heads = [...this.heads.filter((p) => p.castId !== castId), envelope].sort((a, b) =>
      a.castId.localeCompare(b.castId),
    );
    localStorage.setItem(workshopSaveKey(state), this.localSave(state));
    this.status = `${person.name}: ${envelope.terminal ? 'The end of this character history was saved' : 'The character history was saved'}. Source data and state that cannot transfer remain in the local export.`;
    this.changed();
  }
  async checkpointAll() {
    if (this.fileSession) return;
    for (const id of Object.keys(CAST_IDS)) {
      try {
        await this.checkpoint(id);
      } catch (error) {
        this.status = String(error);
      }
    }
    this.changed();
  }
  /** File progress is a recording save, never an owner-native write. */
  persist(state: GameState, capture = true) {
    if (!this.started) return;
    if (this.fileSession) {
      lab.captureSave({
        key: `workshop-file:${this.runId}`,
        value: JSON.parse(this.localSave(state)),
      });
      return;
    }
    localStorage.setItem(workshopSaveKey(state), this.localSave(state));
    if (capture) lab.captureSave(JSON.parse(saveGame(state)));
  }
  closeFile() {
    if (!this.fileSession) throw new Error('This is not a file session.');
    this.generation++;
    this.started = false;
    this.loaded = false;
    this.heads = [];
    this.pendingLocal = null;
    this.fileSources = [];
    this.fileOrigin = false;
    this.state = null;
    this.update = null;
    this.changed = () => {};
    lab.setPersonaRecording(null);
  }
  exportRun(state: GameState) {
    let castSources: unknown[] = [];
    try {
      const journal = this.fileSession
        ? []
        : JSON.parse(localStorage.getItem('small-works-source-journal-v2') ?? '[]');
      castSources = journal.filter((row: { runId?: string }) => row.runId === this.runId);
    } catch {}
    return JSON.stringify({
      ...JSON.parse(saveGame(state)),
      castSources: [...this.fileSources, ...castSources],
    });
  }
}
export const continuity = new WorkshopContinuity();
