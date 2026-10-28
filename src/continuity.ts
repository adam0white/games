import {
  anchorPersonaLife,
  canonicalCast,
  claimCastChapterBatch,
  closePersonaBranch,
  createPersona,
  initialPersonaLife,
  type LifeBatchPreparation,
  type PersonaEnvelope,
  personaChannel,
  validatePersona,
  watchPersonaCheckpoint,
} from '@adam0white/lab-client';
import { admitWorkshop, CAST, CAST_IDS, type CastChapter, workshopTransfer } from './game/cast';
import { createGame } from './game/engine';
import { attachWorkshop } from './game/hf';
import { loadGame, MAX_GAME_SAVE_LENGTH, saveGame } from './game/persistence.ts';
import type { GameState } from './game/types';
import { lab } from './lab';
import { pauseForDeparture, resumeForPlay } from './ui/chapter';

import {
  LOCAL_KEY,
  OUTCOME_LOCAL_KEY,
  readWorkshopSave,
  SOURCE_JOURNAL_KEY,
  writeWorkshopSave,
} from './workshop-storage.ts';

export { LOCAL_KEY, OUTCOME_LOCAL_KEY } from './workshop-storage.ts';
export const workshopSaveKey = (state: GameState) =>
  state.castOutcomes ? OUTCOME_LOCAL_KEY : LOCAL_KEY;
interface LocalMeta {
  runId: string;
  fileSources: unknown[];
  heads: PersonaEnvelope[];
  fileOrigin: boolean;
  unclaimedCastIds?: string[];
}
const source = () => ({
  game: 'repair',
  build: String(lab.build().c ?? 'local'),
  engine: '4.7.0',
  rules: 'canonical-workshop-2',
});
/** One source of ownership and recording permission. Local receipts never replace initial replay actors. */
export class WorkshopContinuity {
  readonly fileSession = typeof location !== 'undefined' && /^\/file\/?$/.test(location.pathname);
  readonly shelf = this.fileSession ? undefined : personaChannel();
  generation = 0;
  heads: PersonaEnvelope[] = [];
  fileOrigin = false;
  private unclaimedCastIds = new Set<string>();
  get historyNotice() {
    return this.unclaimedCastIds.size
      ? `Earlier character histories were kept in their source. These characters start fresh here: ${[...this.unclaimedCastIds].map((id) => canonicalCast(id).name).join(', ')}. This workshop does not replace those histories.`
      : '';
  }
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
    await this.persist(paused, false);
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
      JSON.stringify(saved.continuity.fileSources).length > MAX_GAME_SAVE_LENGTH
    )
      throw new Error('The saved source archive is invalid.');
    if (
      saved.continuity.unclaimedCastIds !== undefined &&
      (!Array.isArray(saved.continuity.unclaimedCastIds) ||
        saved.continuity.unclaimedCastIds.length > 4 ||
        saved.continuity.unclaimedCastIds.some(
          (id: unknown) => !CAST.some((cast) => cast.castId === id),
        ))
    )
      throw new Error('The saved fresh-character boundary is invalid.');
    this.unclaimedCastIds = new Set(saved.continuity.unclaimedCastIds ?? []);
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
        unclaimedCastIds: [...this.unclaimedCastIds],
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
      const legacyIds = new Set<string>();
      const currentIds = new Set<string>();
      let preflightFailure: Error | undefined;
      if (shelf.enabled) {
        let result: Awaited<ReturnType<typeof claimCastChapterBatch<GameState['people']>>>;
        let prepared = false;
        const bridge = {
          request: async <T>(request: Parameters<typeof shelf.request>[0]): Promise<T> => {
            const reply = await shelf.request<T>(request);
            if (request.action === 'prepareBatch') {
              prepared = true;
              const batch = reply as unknown as LifeBatchPreparation;
              const inputs = batch.inputs.filter((input) => {
                if (!CAST.some((cast) => cast.castId === input.parent.castId))
                  throw new Error('The source has an unknown character.');
                if (!input.parent.source.engine.startsWith('4.')) {
                  legacyIds.add(input.parent.castId);
                  return false;
                }
                currentIds.add(input.parent.castId);
                if (
                  input.parent.source.game !== 'repair' &&
                  input.parent.source.game !== 'commonstead'
                )
                  preflightFailure = new Error(
                    'A current character is still in another chapter. Continue or export that chapter first.',
                  );
                return true;
              });
              const blocked = [];
              for (const item of batch.blocked) {
                const revision = batch.expectedHeads[item.castId];
                const parent = revision
                  ? await shelf.request<PersonaEnvelope | null>({
                      action: 'get',
                      castId: item.castId,
                      revision,
                    })
                  : null;
                if (parent && !parent.source.engine.startsWith('4.')) legacyIds.add(item.castId);
                else {
                  blocked.push(item);
                  preflightFailure = new Error(
                    `${canonicalCast(item.castId).name}: ${item.reason}`,
                  );
                }
              }
              return { ...batch, inputs, blocked } as T;
            }
            return reply;
          },
        };
        try {
          result = await claimCastChapterBatch(
            bridge,
            CAST.map((c) => c.castId),
            source(),
            async (inputs) => {
              if (preflightFailure) throw preflightFailure;
              if (
                inputs.length !== currentIds.size ||
                [...currentIds].some((id) => !inputs.some((input) => input.parent.castId === id))
              )
                throw new Error(
                  'A current character history could not be loaded. Keep or export its source chapter.',
                );
              const copy = structuredClone(base);
              attachWorkshop(copy);
              const people = copy.people;
              for (const input of inputs) {
                const id = Object.keys(CAST_IDS).find((id) => CAST_IDS[id] === input.parent.castId);
                const opening = id ? people[id] : undefined;
                if (!id || !opening)
                  throw new Error('This character is not assigned to the workshop.');
                people[id] = admitWorkshop(input, opening);
              }
              return people;
            },
            {
              isCurrent: () => generation === this.generation,
              admitPerson: async (input) => {
                try {
                  const test = createGame(seed);
                  const role = Object.keys(CAST_IDS).find(
                    (id) => CAST_IDS[id] === input.parent.castId,
                  );
                  if (!role || !test.people[role])
                    throw new Error('This character has no workshop role.');
                  admitWorkshop(input, test.people[role]!);
                } catch (error) {
                  preflightFailure = error instanceof Error ? error : new Error(String(error));
                  throw error;
                }
              },
            },
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
      this.unclaimedCastIds = legacyIds;
      this.fileOrigin = false;
      this.pendingLocal = null;
      this.loaded = true;
      this.started = true;
      this.recordAfterStart = true;
      if (generation !== this.generation)
        throw new Error('The identity or game changed before the chapter started.');
      this.status = legacyIds.size
        ? this.historyNotice
        : shelfUnavailable
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
        JSON.stringify(importedSources).length > MAX_GAME_SAVE_LENGTH)
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
    this.unclaimedCastIds.clear();
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
    if (this.unclaimedCastIds.has(castId))
      throw new Error(
        'This character starts fresh in HF4. The earlier history is still in its source. Download this workshop to keep it.',
      );
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
      // Keep one complete game snapshot per distinct save, plus every source revision binding.
      // Snapshot rows and receipt rows remain local; neither is sent to the shelf or telemetry.
      const text = saveGame(state);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const snapshotId = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      const journal = JSON.parse(readWorkshopSave(SOURCE_JOURNAL_KEY) ?? '[]');
      if (!Array.isArray(journal))
        throw new Error('The source history could not be read. Keep the original data.');
      if (
        !journal.some(
          (row) =>
            row.runId === runId && row.snapshotId === snapshotId && row.kind === 'game-snapshot',
        )
      )
        journal.push({ runId, kind: 'game-snapshot', snapshotId, game: JSON.parse(text) });
      journal.push({ runId, revision: envelope.revision, source: source(), snapshotId });
      await writeWorkshopSave(SOURCE_JOURNAL_KEY, JSON.stringify(journal));
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
    await writeWorkshopSave(workshopSaveKey(state), this.localSave(state));
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
  async persist(state: GameState, capture = true) {
    if (!this.started) return;
    if (this.fileSession) {
      lab.captureSave({
        key: `workshop-file:${this.runId}`,
        value: JSON.parse(saveGame(state)),
      });
      return;
    }
    await writeWorkshopSave(workshopSaveKey(state), this.localSave(state));
    if (capture) lab.captureSave(JSON.parse(saveGame(state)));
  }
  closeFile() {
    if (!this.fileSession) throw new Error('This is not a file session.');
    this.generation++;
    this.started = false;
    this.loaded = false;
    this.heads = [];
    this.unclaimedCastIds.clear();
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
        : JSON.parse(readWorkshopSave(SOURCE_JOURNAL_KEY) ?? '[]');
      castSources = journal.filter((row: { runId?: string }) => row.runId === this.runId);
    } catch {}
    return JSON.stringify({
      ...JSON.parse(saveGame(state)),
      castSources: [...this.fileSources, ...castSources],
    });
  }
}
export const continuity = new WorkshopContinuity();
