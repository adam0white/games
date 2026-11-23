/** Browser-only ownership and recording control. Initial replay actors never change here.
 * A local receipt is authority to try its exact parent again, never to refresh a live run.
 * File imports always lose ownership and stay file-origin through subsequent local saves.
 */
import { exportRun } from '@adam0white/human-framework';
import {
  anchorPersonaLife,
  canonicalCast,
  canonicalPersona,
  closePersonaBranch,
  createPersona,
  initialPersonaLife,
  type Lab,
  type PersonaEnvelope,
  type PersonaLife,
  type PersonaRequest,
  personaChannel,
  portablePersonRole,
  portableWriteBlockers,
  validatePersona,
  watchPersonaCheckpoint,
} from '@adam0white/lab-client';
import { ALLOCATION, localRole } from '../sim/cast.ts';
import { departureObligations } from '../sim/departure.ts';
import { PUBLIC_EDITION, type RulesEdition, rulesOf } from '../sim/edition.ts';
import { type Game, load, newGame, type SavedGame, save } from '../sim/game.ts';
import { FRAMEWORK_VERSION as ENGINE_VERSION, type Person, personRun } from '../sim/hf.ts';
import {
  checkpointTransfer,
  HOST_RULES,
  type NativeCastSource,
  prepareCastStart,
  validateCheckpointLineage,
  validateCheckpointSource,
  validateTerminalSource,
} from '../sim/passport.ts';
import { foundValley } from '../sim/people.ts';
import { termsVerb } from '../sim/terms.ts';
export interface CastSourceRef {
  revision: string;
  actorId: string;
  fullHash: string;
}
export interface LocalCastReceipt {
  runId: string;
  fileOrigin: boolean;
  localOnly: boolean;
  heads: Record<string, PersonaEnvelope>;
  sources: Record<string, { revision: string; person: NativeCastSource }>;
  sourceRefs?: Record<string, CastSourceRef>;
  archiveHeads?: Record<string, PersonaEnvelope>;
}
export interface Shelf {
  ready: Promise<boolean>;
  readonly enabled: boolean;
  setEnabled(value: boolean): void;
  request<T>(request: PersonaRequest): Promise<T>;
}
function writeBlocker(castId: string): string | undefined {
  const peers = portableWriteBlockers(castId, 'valley');
  return peers.length
    ? `${canonicalCast(castId).name}: read-only until ${peers.join(', ')} supports safe shared writes.`
    : undefined;
}
function sourceMap(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid source receipt map. Keep the full native game.');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error('Invalid source receipt map. Keep the full native game.');
  return value as Record<string, unknown>;
}
function validateSourceJournal(sources: LocalCastReceipt['sources']): void {
  if (
    Object.keys(sources).length > 6 ||
    new TextEncoder().encode(canonicalPersona(sources)).byteLength > 1_048_576
  )
    throw new Error('The source receipts are too large. Keep the full native game.');
}
function validateSourceRefs(value: unknown): Record<string, CastSourceRef> {
  const refs = sourceMap(value);
  if (Object.keys(refs).length > 6) throw new Error('Too many source receipts.');
  for (const [id, value] of Object.entries(refs)) {
    const ref = sourceMap(value);
    if (
      !ALLOCATION.some((c) => c.castId === id) ||
      Object.keys(ref).sort().join(',') !== 'actorId,fullHash,revision' ||
      ref.actorId !== localRole(id) ||
      typeof ref.revision !== 'string' ||
      !ref.revision.length ||
      typeof ref.fullHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(ref.fullHash)
    )
      throw new Error('Invalid source reference.');
  }
  return refs as unknown as Record<string, CastSourceRef>;
}
export class CastSession {
  generation = 0;
  runId: string = crypto.randomUUID();
  fileOrigin = false;
  localOnly = false;
  heads: Record<string, PersonaEnvelope> = {};
  sources: LocalCastReceipt['sources'] = {};
  archiveHeads: Record<string, PersonaEnvelope> = {};
  game: Game | null = null;
  status =
    'Continuing people between games in this browser is separate from recording. When recording is on, recorded play links automatically.';
  private busy = false;
  private failedCheckpoint = false;
  private panel?: HTMLElement;
  private saveLocal?: () => void;
  constructor(
    readonly lab: Pick<
      Lab,
      'setPersonaRecording' | 'allowPersonaRecording' | 'personaRecordingAllowed' | 'build'
    >,
    readonly shelf: Shelf | null = personaChannel(),
  ) {
    this.invalidate(); // Must happen before any run/log/save/upload hook is attached.
  }
  invalidate() {
    this.generation++;

    this.lab.setPersonaRecording(`valley-group-${crypto.randomUUID()}`);
    this.lab.allowPersonaRecording(true);
    this.render();
  }
  async fresh(seed: number, _localOnly = true, rules?: RulesEdition): Promise<Game> {
    // This episode starts a fresh local cast. Stored people remain untouched.
    this.invalidate();
    const header = prepareCastStart(foundValley(seed, 0).people, []);
    const g = newGame(seed, header, false, true, rules);
    this.game = g;
    this.failedCheckpoint = false;
    this.runId = crypto.randomUUID();
    this.heads = {};
    this.sources = {};
    this.archiveHeads = {};
    this.fileOrigin = false;
    this.localOnly = true;
    this.status =
      'This opening episode starts fresh. Stored people are unchanged. Keep or download this game to resume it; continuing people between games is unavailable in this edition.';
    this.render();
    return g;
  }
  async activate(g: Game): Promise<void> {
    if (this.game !== g) throw new Error('Run changed before ledger installation.');
    if (g.cast?.inputs.length) await this.queryRecording();
    else this.lab.setPersonaRecording(null);
  }
  async loaded(
    g: Game,
    meta?: LocalCastReceipt,
    fromFile = false,
    fileArchive?: Pick<SavedGame, 'castHeads' | 'castSources' | 'castSourceRefs'>,
  ): Promise<void> {
    const generation = this.generation;
    const heldGame = this.game;
    const runId = meta?.runId ?? crypto.randomUUID();
    const fileOrigin = fromFile || meta?.fileOrigin === true;
    const heads: Record<string, PersonaEnvelope> = {};
    const archiveHeads: Record<string, PersonaEnvelope> = {};
    if (typeof runId !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(runId))
      throw new Error('Invalid local run receipt.');
    for (const input of g.cast?.inputs ?? []) await validatePersona(input.parent);
    for (const claim of g.cast?.claims ?? []) await validatePersona(claim);
    const candidateHeads = fromFile
      ? (fileArchive?.castHeads ?? { ...meta?.archiveHeads, ...meta?.heads })
      : { ...meta?.archiveHeads, ...meta?.heads };
    if (Object.keys(candidateHeads).length > 6) throw new Error('Too many cast receipts.');
    for (const [id, raw] of Object.entries(candidateHeads)) {
      const head = await validatePersona(raw);
      if (head.castId !== id || !ALLOCATION.some((c) => c.castId === id))
        throw new Error('Outside cast receipt.');
      archiveHeads[id] = head;
      if (fromFile || meta?.heads?.[id]?.revision !== head.revision) continue;
      // Only a locally accepted native source receipt can own a file-origin alternative.
      const nativeOwned =
        head.transfer.hostRun === runId &&
        head.transfer.castPassport === 'hf-portable-person/2' &&
        head.source.rules === HOST_RULES;
      if ((fileOrigin || meta?.localOnly) && !nativeOwned)
        throw new Error('Imported receipts do not grant alternative ownership.');
      const initial = g.cast?.claims.find((c) => c.castId === id);
      const initialClaim = initial?.revision === head.revision;
      const terminalOfClaim = !!head.terminal && initial?.revision === head.parentRevision;
      if (
        (!initialClaim && head.source.game !== 'valley') ||
        (!initialClaim && !terminalOfClaim && head.transfer.hostRun !== runId) ||
        (initial && head.branchId !== initial.branchId && !nativeOwned)
      )
        throw new Error('Invalid local ownership receipt.');
      heads[id] = head;
    }
    // Neither outer map may hide behind refs or the other representation.
    for (const supplied of [meta?.sources, fileArchive?.castSources]) {
      if (supplied === undefined) continue;
      if (Object.keys(sourceMap(supplied)).length)
        throw new Error('Outer source archives are not supported. Keep the full native game.');
    }
    const localRefs = meta?.sourceRefs === undefined ? undefined : validateSourceRefs(meta.sourceRefs);
    const fileRefs =
      fileArchive?.castSourceRefs === undefined ? undefined : validateSourceRefs(fileArchive.castSourceRefs);
    if (localRefs && fileRefs && canonicalPersona(localRefs) !== canonicalPersona(fileRefs))
      throw new Error('Conflicting source references. Keep the full native game.');
    const refs = fileRefs ?? localRefs ?? {};
    const sources: LocalCastReceipt['sources'] = {};
    for (const [id, ref] of Object.entries(refs)) {
      const head = archiveHeads[id];
      if (!head || head.revision !== ref.revision) throw new Error('Source archive lacks its exact receipt.');
      const live = g.valley.castReleased?.[ref.actorId];
      const dead = g.valley.castDeaths?.[ref.actorId];
      if (live && dead) throw new Error('The game has ambiguous frozen sources for this receipt.');
      const person = head.terminal ? dead : live;
      if (!person) throw new Error('The game has no frozen source for this receipt.');
      const source = nativeSource(person);
      if (source.actorId !== ref.actorId || source.archive.hashes.full !== ref.fullHash)
        throw new Error('The source reference differs from the played game.');
      sources[id] = { revision: ref.revision, person: source };
    }
    validateSourceJournal(sources);
    for (const [id, source] of Object.entries(sources)) {
      const head = archiveHeads[id];
      if (!head) throw new Error('Source archive lacks its exact receipt.');
      if (head.terminal) await validateTerminalSource(source.person, head);
      else await validateCheckpointSource(source.person, head);
    }
    for (const [id, source] of Object.entries(sources)) {
      const head = archiveHeads[id];
      if (!head) throw new Error('Source archive lacks its exact receipt.');
      const actorId = source.person.actorId;
      const live = g.valley.castReleased?.[actorId];
      const dead = g.valley.castDeaths?.[actorId];
      const person = head.terminal ? dead : live;
      if (
        !person ||
        (live && dead) ||
        canonicalPersona(nativeSource(person)) !== canonicalPersona(source.person)
      )
        throw new Error('The frozen source changed during local load.');
    }
    if (generation !== this.generation || this.game !== heldGame)
      throw new Error('Run or identity changed during local load.');
    this.invalidate();
    this.game = g;
    this.failedCheckpoint = false;
    this.runId = runId;
    this.fileOrigin = fileOrigin;
    this.localOnly = true;
    this.heads = heads;
    this.archiveHeads = archiveHeads;
    this.sources = sources;
    if (!fileOrigin && !g.cast?.inputs.length && !Object.keys(heads).length)
      this.lab.setPersonaRecording(null);
    else if (!fileOrigin) await this.queryRecording();
    this.status = fileOrigin
      ? 'This game was loaded from a file. Its saved receipts do not let you update the original people. When recording is on, recorded play links automatically.'
      : 'The saved game and its local receipts have been checked and loaded. The people keep their saved versions. The latest versions in browser storage were not read.';
    this.render();
  }
  private sourceRefs(): Record<string, CastSourceRef> {
    return Object.fromEntries(
      Object.entries(this.sources).map(([id, source]) => [
        id,
        {
          revision: source.revision,
          actorId: source.person.actorId,
          fullHash: source.person.archive.hashes.full,
        },
      ]),
    );
  }
  metadata(): LocalCastReceipt {
    return structuredClone({
      runId: this.runId,
      fileOrigin: this.fileOrigin,
      localOnly: this.localOnly,
      heads: this.heads,
      sources: {},
      sourceRefs: this.sourceRefs(),
      archiveHeads: this.archiveHeads,
    });
  }
  exportRun(run: SavedGame) {
    return {
      ...run,
      castSourceRefs: this.sourceRefs(),
      castHeads: structuredClone({ ...this.archiveHeads, ...this.heads }),
    };
  }
  private stamps(_rules: RulesEdition | null = (this.game ? rulesOf(this.game.valley) : undefined) ?? null) {
    return {
      game: 'valley',
      build: this.lab.build().c ?? 'development',
      engine: ENGINE_VERSION,
      rules: HOST_RULES,
    };
  }
  /** The complete game log verifies the physical world before publication.
   * A passport cannot remove the host’s unfinished food or work responsibilities. */
  private publicationGuard(g: Game): () => void {
    const source = () => {
      const { savedAt: _savedAt, ...run } = save(g);
      return canonicalPersona({ run, metadata: this.metadata() });
    };
    load(save(g));
    if (g.valley.receivedTerms || g.inputs.some((i) => termsVerb(i.verb)))
      throw new Error(
        'These received words and food/work terms have no reviewed continuing-person mapping. Download the complete native game instead.',
      );
    const captured = source();
    const generation = this.generation;
    return () => {
      if (this.game !== g || this.generation !== generation || source() !== captured)
        throw new Error('Source, ownership or file origin changed before publication. Keep the native game.');
    };
  }
  async queryRecording(_allow?: boolean): Promise<void> {
    this.lab.allowPersonaRecording(true);
    this.render();
  }
  async checkpoint(manual = false): Promise<void> {
    if (this.game && rulesOf(this.game.valley) === PUBLIC_EDITION) {
      this.status =
        'Person publication is unavailable in this opening episode. Download the complete game instead; stored people are unchanged.';
      this.render();
      return;
    }
    if (!this.shelf) return;
    // Public native/source authority is checked even when the older edition gate
    // will also refuse publication. Stripping both new copies is not a bypass.
    if (this.game && manual) {
      try {
        this.publicationGuard(this.game);
      } catch (error) {
        this.failedCheckpoint = true;
        this.status = `The checkpoint was refused: ${error instanceof Error ? error.message : String(error)} Keep or download the native game.`;
        this.render();
        return;
      }
    }
    if ((this.failedCheckpoint && !manual) || this.busy || !this.game || !this.shelf.enabled) return;
    this.busy = true;
    const generation = this.generation;
    const g = this.game;
    try {
      const blocked: string[] = [];
      for (const c of ALLOCATION) {
        const id = localRole(c.castId);
        const parent = this.heads[c.castId];
        if ((this.fileOrigin || this.localOnly) && !parent) continue;
        const dead = g.valley.castDeaths?.[id];
        if (parent?.terminal) continue;
        if ((dead && parent) || g.valley.castReleased?.[id]) {
          const reason = writeBlocker(c.castId);
          if (reason) {
            blocked.push(reason);
            continue;
          }
        }
        if (dead && parent) {
          const stillCurrent = this.publicationGuard(g);
          const terminal = await closePersonaBranch(parent, this.stamps(), Math.round(dead.now * 60000));
          const native = nativeSource(dead);
          await validateTerminalSource(native, terminal);
          const nextSources = {
            ...this.sources,
            [c.castId]: { revision: terminal.revision, person: native },
          };
          validateSourceJournal(nextSources);
          if (generation !== this.generation) break;
          stillCurrent();
          await this.shelf.request({ action: 'put', envelope: terminal });
          stillCurrent();
          if (generation !== this.generation) break;
          this.lab.setPersonaRecording(`valley-group-${crypto.randomUUID()}`);
          this.lab.allowPersonaRecording(true);

          this.heads[c.castId] = terminal;
          this.sources = nextSources;
          this.saveLocal?.();
          await this.queryRecording();
          continue;
        }
        const raw = g.valley.castReleased?.[id];
        if (!raw) continue;
        if (
          parent?.transfer.hostRun === this.runId &&
          (parent.transfer.checkpoint as { at?: number } | undefined)?.at === Math.round(raw.now * 60000)
        )
          continue;
        const stillCurrent = this.publicationGuard(g);
        const prepared = await checkpointTransfer(
          raw,
          c.castId,
          this.stamps(),
          parent,
          departureObligations(g.valley, id),
        );
        const priorSource = this.sources[c.castId];
        if (priorSource && parent?.revision === priorSource.revision)
          await validateCheckpointLineage(prepared.source, priorSource.person, c.castId);
        const branchId = parent?.branchId ?? crypto.randomUUID();
        const oldLife = parent?.transfer.life as PersonaLife | undefined;
        const life = oldLife
          ? anchorPersonaLife(oldLife, c.castId, Date.now())
          : initialPersonaLife(c.castId, branchId, Date.now());
        const envelope = await createPersona({
          format: 'hf-persona/1',
          castId: c.castId,
          castRevision: c.revision,
          branchId,
          parentRevision: parent?.revision ?? null,
          source: this.stamps(),
          transfer: { ...prepared.transfer, hostRun: this.runId, life },
          limitations: [
            'Supported retained history continues. The complete source Run and host world stay in the native game file.',
          ],
        });
        if (portablePersonRole(envelope, 'valley') !== raw.id)
          throw new Error('Checkpoint identity differs.');
        const nextSources = {
          ...this.sources,
          [c.castId]: { revision: envelope.revision, person: prepared.source },
        };
        validateSourceJournal(nextSources);
        const authored = !parent && !g.cast?.inputs.length && !this.fileOrigin;
        if (generation !== this.generation) break;
        stillCurrent();
        await this.shelf.request({
          action: 'put',
          envelope,
          authored,
        });
        stillCurrent();
        if (generation !== this.generation) break;
        this.lab.setPersonaRecording(`valley-group-${crypto.randomUUID()}`);
        this.lab.allowPersonaRecording(true);

        this.heads[c.castId] = envelope;
        this.sources = nextSources;
        this.status = `${c.name}: the saved checkpoint was accepted. Details this game cannot use remain in the local archive.`;
        this.saveLocal?.();
        await this.queryRecording();
      }
      if (blocked.length) this.status = `${blocked.join(' ')} Keep or download this game.`;
    } catch (error) {
      if (generation !== this.generation) return;
      this.failedCheckpoint = true;
      this.status = `The checkpoint was refused: ${error instanceof Error ? error.message : String(error)} Keep this game or download a copy. If its previous version is out of date, the game will not retry with the latest version.`;
    } finally {
      this.busy = false;
      this.render();
    }
  }
  /** Explicit new root from this played source, never adoption of embedded ownership. */
  async alternative(castId: string): Promise<void> {
    if (this.game && rulesOf(this.game.valley) === PUBLIC_EDITION) {
      this.status =
        'Alternative person histories are unavailable in this opening episode. Download the complete game instead; stored people are unchanged.';
      this.render();
      return;
    }
    if (!this.shelf) return;
    if (this.busy) return;
    const g = this.game;
    const generation = this.generation;
    const runId = this.runId;
    this.busy = true;
    try {
      const c = ALLOCATION.find((p) => p.castId === castId);
      if (!g || !c || !this.shelf.enabled)
        throw new Error('Open a game you have played and turn on continuing people in this browser first.');
      const stillCurrent = this.publicationGuard(g);
      const reason = writeBlocker(castId);
      if (reason) throw new Error(reason);
      const raw = g.valley.castReleased?.[localRole(castId)];
      if (!raw?.body.alive || raw.activity)
        throw new Error(
          'This person must finish their current work and pause first. This action does not remove any activity, care or goal.',
        );
      const previous =
        this.heads[castId] ?? this.archiveHeads[castId] ?? g.cast?.claims.find((p) => p.castId === castId);
      const prepared = await checkpointTransfer(
        raw,
        castId,
        this.stamps(),
        previous,
        departureObligations(g.valley, raw.id),
      );
      const branchId = crypto.randomUUID();
      const envelope = await createPersona({
        format: 'hf-persona/1',
        castId,
        castRevision: c.revision,
        branchId,
        parentRevision: null,
        source: this.stamps(),
        transfer: {
          ...prepared.transfer,
          hostRun: runId,
          life: initialPersonaLife(castId, branchId, Date.now()),
          alternativeSource: {
            version: 'valley-explicit-alternative/1',
            previousReceipt: previous?.revision ?? null,
            initialClaim: g.cast?.claims.find((p) => p.castId === castId)?.revision ?? null,
            fileOrigin: this.fileOrigin,
            localOnly: this.localOnly,
          },
        },
        limitations: [
          'Explicit alternative from a played Valley chapter. Prior receipts remain history and grant no ownership of this new root. Full source state stays in the source export.',
        ],
      });
      if (portablePersonRole(envelope, 'valley') !== raw.id) throw new Error('Checkpoint identity differs.');
      const sources = { ...this.sources, [castId]: { revision: envelope.revision, person: prepared.source } };
      validateSourceJournal(sources);
      await this.shelf.ready;
      if (generation !== this.generation || this.game !== g || this.runId !== runId) return;
      stillCurrent();
      await this.shelf.request({ action: 'put', envelope, fork: true });
      stillCurrent();
      if (generation !== this.generation || this.game !== g || this.runId !== runId) return;
      this.lab.setPersonaRecording(`valley-group-${crypto.randomUUID()}`);
      this.lab.allowPersonaRecording(true);

      this.heads[castId] = envelope;
      this.sources = sources;
      this.failedCheckpoint = false;
      this.status = `${c.name}: a new alternative history with no parent was accepted. The previous history is kept. Download this game’s checkpoint and keep a full copy of the game.`;
      this.saveLocal?.();
      await this.queryRecording();
    } catch (error) {
      if (generation === this.generation)
        this.status = `The alternative history was refused: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      this.busy = false;
      this.render();
    }
  }
  connect(saveLocal: () => void) {
    this.saveLocal = saveLocal;
    if (this.shelf)
      watchPersonaCheckpoint(() => {
        // Local editions cannot publish. Keep complete source validation on explicit
        // checkpoint/alternative actions rather than replaying on document exit.
        if (
          !this.game ||
          (!Object.keys(this.game.valley.castReleased ?? {}).length &&
            !Object.keys(this.game.valley.castDeaths ?? {}).length)
        )
          return;
        return this.checkpoint();
      });
  }
  mount(host: HTMLElement, saveLocal: () => void) {
    this.saveLocal = saveLocal;
    this.panel = document.createElement('section');
    this.panel.className = 'cast-controls';
    this.panel.innerHTML =
      '<h3>People in this episode</h3><p>This opening episode starts with fresh people. It leaves stored people unchanged. Continuing or publishing people between games is unavailable here. Use the full game download to keep this morning.</p><p data-cast-status role="status"></p>';
    host.append(this.panel);
    this.render();
  }
  render() {
    if (!this.panel) return;
    const status = this.panel.querySelector('[data-cast-status]');
    if (status)
      status.textContent = `${this.status} Recorded play links across games on this device when recording is on. Change recording in the menu.`;
    const box = this.panel.querySelector<HTMLInputElement>('[data-continuity]');
    if (box) box.checked = this.shelf?.enabled ?? false;
  }
}

function nativeSource(person: Person): NativeCastSource {
  const run = personRun(person);
  if (!run) throw new Error('The current person has no native Run.');
  return { actorId: person.id, archive: structuredClone(exportRun(run)) as NativeCastSource['archive'] };
}
