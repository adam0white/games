import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPersona,
  initialPersonaLife,
  type PersonaRequest,
  portableWriteBlockers,
  preparePersonaLife,
  validatePersona,
} from '@adam0white/lab-client';
import { expect, test } from 'vitest';
import { CAST } from '../src/sim/cast.ts';
import { prepareAgencyChapter } from '../src/sim/cast-chapter.ts';
import { saveFramework, tick } from '../src/sim/hf4.ts';
import { newGame } from '../src/sim/index.ts';
import { publishNativeCheckpoint } from '../src/ui/checkpoint.ts';
import { emptyContinuity } from '../src/ui/continuity.ts';
import { nativePublicationTransfer, PORTABLE_RETURN_LIMITATION } from '../src/ui/native-transfer.ts';
import parentFixture from './fixtures/pass-current-native-v2.json' with { type: 'json' };

// Genuine current Pass producer input; the host departure overlay below is synthetic.
// This is protocol wiring evidence, not a played month or a live shelf journey.
test('an actual Pass portable-v2 source publishes native history without obsolete return projection', async () => {
  expect(
    portableWriteBlockers('hf.cast.zeynep.pass', 'goodhands'),
    'published catalog before admission',
  ).toEqual([]);
  const parent = await validatePersona(parentFixture);
  expect(parent.source.game).toBe('pass');
  expect(parent.transfer.castPassport).toBe('hf-portable-person/2');
  expect(parent.transfer.portable).toMatchObject({
    version: 2,
    source: { game: 'pass', personId: 'zeynep', engine: '4.17.0' },
  });
  const parentBytes = JSON.stringify(parent);
  const chapter = await prepareAgencyChapter([preparePersonaLife(parent, 0)], 9);
  const state = newGame(9, 6, [], chapter);
  const guest = (state.guests as { id: string; arrival: number; status: string }[]).find(
    (g) => g.id === 'zeynep-pass',
  )!;
  // Bound the host departure condition, as hf481-arrival does for the arrival boundary.
  // HF still admits the original retained visitor through its actual arrival input.
  tick(state.people.nermin!, guest.arrival + 1);
  state.now = guest.arrival + 1;
  guest.status = 'complete';
  state.castPaused = true;
  saveFramework(state);
  const sourceBytes = JSON.stringify(state);
  const transfer = await nativePublicationTransfer(state, 'zeynep-pass');
  expect(transfer.returnDisposition).toBe('portable-v2-only');
  expect(transfer.currentFormatLimitations).toContain(PORTABLE_RETURN_LIMITATION);
  expect(transfer.person).toBeUndefined();
  expect(transfer.returnOrigin).toBeUndefined();
  expect(transfer.portable).toMatchObject({ version: 2 });
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST['zeynep-pass'].castId,
    castRevision: CAST['zeynep-pass'].revision,
    branchId: parent.branchId,
    parentRevision: parent.revision,
    source: { game: 'goodhands', build: 'synthetic-port-control', engine: '4.17.0', rules: 'goodhands-6' },
    transfer: { ...transfer, life: initialPersonaLife(parent.castId, parent.branchId, 0) },
    limitations: [PORTABLE_RETURN_LIMITATION],
  });
  const book = emptyContinuity();
  book.chapter = chapter;
  book.heads = [parent];
  const writes: PersonaRequest[] = [];
  let retained = '';
  await publishNativeCheckpoint(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(request: PersonaRequest): Promise<T> {
        writes.push(request);
        return request.envelope as T;
      },
    },
    book,
    envelope,
    parent,
    false,
    () => true,
    state,
    {
      retainSource: async () => {
        retained = JSON.stringify(state);
        return true;
      },
    },
  );
  expect(writes.map((r) => r.action)).toEqual(['put']);
  expect(writes[0]?.envelope?.transfer.person).toBeUndefined();
  expect(retained).toBe(sourceBytes);
  expect(JSON.stringify(state)).toBe(sourceBytes);
  expect(JSON.stringify(parent)).toBe(parentBytes);
}, 180000);

test('the production graph contains no game legacy engine, archive import or old projector', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  expect(
    Object.keys(pkg.dependencies).filter((k) => /(?:human-framework|lab-client)-legacy/.test(k)),
  ).toEqual([]);
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.[cm]?[jt]sx?$/.test(path)) {
        const source = readFileSync(path, 'utf8');
        expect(source, path).not.toMatch(
          /(?:from\s+|import\s*\()["'][^"']*(?:human-framework-legacy|lab-client-legacy|archive\/historical|sim\/v[1-6]\/)/,
        );
        expect(source, path).not.toMatch(/guestCheckpointTransfer|projectCalendarPersona|projectPersona\(/);
      }
    }
  };
  visit('src');
  visit('scripts');
  expect(readFileSync('src/ui/app.ts', 'utf8')).toContain('nativePublicationTransfer(pinned, id)');
});
