import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { readRunHistory, replay } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { act, createGame, exportRun, hashState, reading, replayRun, view } from '../src/game';
import { expectReplay } from './support/replay';

function choose(s: ReturnType<typeof createGame>, text: string) {
  const c = view(s).choices.find((x) => x.text.includes(text));
  if (!c) throw new Error(`Missing choice: ${text}`);
  act(s, { choice: c.id });
}
function start(seed = 42) {
  const s = createGame(seed);
  choose(s, 'Put the notebook');
  return s;
}
function sign(s: ReturnType<typeof createGame>) {
  for (let i = 0; i < 5 && s.result === 'playing'; i++) {
    const waiting = view(s).choices.some((c) => c.text.includes('Wait for Rıza'));
    choose(s, waiting ? 'Wait for Rıza' : 'next person');
  }
}

function askAll(s: ReturnType<typeof createGame>) {
  for (const name of ['Halil', 'Rıza', 'Osman', 'Ferda']) {
    choose(s, 'Hear what');
    choose(s, `Ask ${name}`);
  }
}

describe('answers a repeated refusal as a person, varied by seed and exact on replay', () => {
  // One case per seed; the cases run in order and the last checks variety across them.
  const lines = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    it(`seed ${seed}`, () => {
      const s = start(seed);
      choose(s, 'Write an agreement');
      choose(s, 'Rent an outside');
      const notes: string[] = [];
      for (let i = 0; i < 7 && s.result === 'playing'; i++) {
        choose(s, 'next person');
        notes.push(s.note);
      }
      const ferda = notes.filter((n) => n.includes('Ferda'));
      expect(ferda[0]).toContain('Ferda refuses:');
      expect(new Set(ferda.slice(0, 3)).size).toBe(3);
      for (const n of ferda.slice(1)) lines.add(n);
      const screen = view(s);
      expect(screen.prose.join(' ')).toContain('Ferda has refused this agreement');
      expect(screen.prose.join(' ')).not.toContain('minutes needed');
      expect(screen.choices.find((c) => c.text.includes('next person'))?.text).toContain('Ferda has refused');
      expectReplay(s);
    });
  }
  it('varies the refusal lines across seeds', () => {
    expect(lines.size).toBeGreaterThan(3);
  });
});

describe('iteration two bargaining', () => {
  it('refuses the unexplored full lease rather than handing out signatures', () => {
    const s = start();
    choose(s, 'Write an agreement');
    choose(s, 'Rent an outside');
    sign(s);
    expect(s.result).toBe('playing');
    expect(s.proposal?.consents).not.toContain('ferda');
    expect(s.note).toContain('smaller');
  });
  it('offers Ferda a smaller agreement after her full-lease refusal without a hidden rent conversation', () => {
    const s = start();
    choose(s, 'Write an agreement');
    choose(s, 'Rent an outside');
    sign(s);
    expect(s.log.some((entry) => entry.text.startsWith('Ferda refuses:'))).toBe(true);
    choose(s, 'Hear what');
    choose(s, 'Ask Ferda');
    choose(s, 'Fetch Nuri');
    choose(s, 'Write an agreement');
    const offers = view(s).choices.map((c) => c.text);
    expect(offers.some((text) => text.includes('Morning work. Smaller'))).toBe(true);
    expect(offers.some((text) => text.includes('smaller late service'))).toBe(true);
    expect(offers.some((text) => text.includes('cart inside. Smaller'))).toBe(true);
    expect(s.asked).not.toContain('osman');
  });
  it('requires Osman to agree to a visible trial offer and explains how to rewrite it', () => {
    const s = start();
    choose(s, 'Write an agreement');
    choose(s, 'Morning work. Smaller');
    choose(s, 'next person');
    choose(s, 'next person');
    choose(s, 'next person');
    expect(s.proposal?.consents).toEqual(['halil', 'riza']);
    expect(s.note).toContain('Osman refuses');
    expect(s.note).toContain('Ask him about rent');
    expect(s.note).toContain('new agreement');
    choose(s, 'Hear what');
    choose(s, 'Ask Osman');
    choose(s, 'Write an agreement');
    choose(s, 'Morning work. Smaller');
    expect(s.proposal?.consents).toEqual([]);
    sign(s);
    expect(s.result).toBe('win');
    expect(s.spent).toBe(100);
    expectReplay(s);
  });
  it('lets all four conversations and the letter produce an affordable agreement in time', () => {
    const s = start();
    askAll(s);
    choose(s, 'Fetch Nuri');
    choose(s, 'Write an agreement');
    choose(s, 'smaller late service');
    expect(view(s).prose.join(' ')).toContain('4 minutes');
    sign(s);
    expect(s.result).toBe('win');
    expect(s.spent).toBe(40);
    expect(s.remaining).toBe(4);
    expectReplay(s);
  });
});

describe('complete negotiation', () => {
  it('settles honestly without exhaustive questions and replays the complete state', () => {
    const s = start();
    for (const name of ['Osman', 'Ferda']) {
      choose(s, 'Hear what');
      choose(s, `Ask ${name}`);
    }
    choose(s, 'Write an agreement');
    choose(s, 'Morning work. Smaller');
    sign(s);
    expect(s.result).toBe('win');
    expect(s.proposal?.consents).toHaveLength(4);
    expect(s.spent).toBe(100);
    const run = exportRun(s);
    expect(hashState(replayRun(JSON.parse(JSON.stringify(run))))).toBe(hashState(s));
    expectReplay(s);
  });
  it('offers a costly letter route with a cheaper late service and no surprise reversal', () => {
    const s = start(7);
    askAll(s);
    choose(s, 'Fetch Nuri');
    expect(s.remaining).toBe(10);
    choose(s, 'Write an agreement');
    choose(s, 'smaller late service');
    sign(s);
    expect(s.result).toBe('win');
    expect(s.spent).toBe(40);
    expect(view(s).prose.join(' ')).toContain('late');
  });
  it('catches the player as the source, gives a recoverable refusal, and can still settle', () => {
    const s = start();
    choose(s, 'in private');
    choose(s, 'Tell Rıza');
    askAll(s);
    choose(s, 'in private');
    choose(s, 'Tell Halil');
    choose(s, 'Write an agreement');
    choose(s, 'cart inside. Smaller');
    expect(s.proposal?.cost).toBe(0);
    choose(s, 'next person');
    expect(s.caught).toBe(true);
    expect(reading(s, 'halil').sourceTrust).toBeLessThan(0.8);
    expect(reading(s, 'riza').sourceTrust).toBeLessThan(0.8);
    expect(s.result).toBe('playing');
    choose(s, 'Write an agreement');
    choose(s, 'Morning work. Smaller');
    sign(s);
    expect(s.result).toBe('win');
    expect(s.spent).toBe(100);
    expectReplay(s);
  });
  it('clears signatures on a counterproposal and ends a failed meeting', () => {
    const s = start();
    choose(s, 'Write an agreement');
    choose(s, 'Rent an outside');
    choose(s, 'next person');
    const oldId = s.proposal?.id;
    choose(s, 'Change the agreement');
    choose(s, 'Rent an outside');
    expect(s.proposal?.id).not.toBe(oldId);
    expect(s.proposal?.consents).toEqual([]);
    choose(s, 'End the meeting');
    expect(s.result).toBe('loss');
    expectReplay(s);
  });
  it('cancels an incomplete shared agreement after late comparison and lets the player recover', () => {
    const s = start();
    choose(s, 'in private');
    choose(s, 'Tell Halil');
    choose(s, 'in private');
    choose(s, 'Tell Rıza');
    for (const name of ['Osman', 'Ferda']) {
      choose(s, 'Hear what');
      choose(s, `Ask ${name}`);
    }
    choose(s, 'Write an agreement');
    choose(s, 'cart inside. Smaller');
    expect(view(s).prose.join(' ')).toContain('delivery round');
    choose(s, 'next person');
    expect(s.proposal?.consents).toEqual(['halil']);
    expect(s.caught).toBe(false);
    choose(s, 'next person');
    choose(s, 'next person');
    choose(s, 'Wait for Rıza');
    const oldAgreement = structuredClone(s.proposal);
    choose(s, 'next person');
    expect(s.caught).toBe(true);
    expect(s.proposal).toBeNull();
    expect(oldAgreement?.consents).toEqual(['halil', 'osman', 'ferda']);
    choose(s, 'Hear what');
    choose(s, 'Ask Rıza');
    choose(s, 'Write an agreement');
    choose(s, 'Morning work. Smaller');
    sign(s);
    expect(s.result).toBe('win');
    expect(s.spent).toBe(100);
    expect(s.remaining).toBe(1);
    expect(view(s).prose.join(' ')).toContain('check every detail');
    expectReplay(s);
  });
  it('also replaces an incomplete honest agreement when comparison reveals the earlier lies', () => {
    const s = start();
    choose(s, 'in private');
    choose(s, 'Tell Halil');
    choose(s, 'in private');
    choose(s, 'Tell Rıza');
    for (const name of ['Osman', 'Ferda']) {
      choose(s, 'Hear what');
      choose(s, `Ask ${name}`);
    }
    choose(s, 'Write an agreement');
    choose(s, 'Morning work. Smaller');
    choose(s, 'next person');
    choose(s, 'next person');
    choose(s, 'next person');
    choose(s, 'Wait for Rıza');
    choose(s, 'next person');
    expect(s.caught).toBe(true);
    expect(s.proposal).toBeNull();
    expect(s.result).toBe('playing');
    expect(s.note).toContain('₺40 deposit');
  });
  it('ends the meeting when a final-minute comparison cancels the unsigned agreement', () => {
    const s = start();
    choose(s, 'in private');
    choose(s, 'Tell Halil');
    choose(s, 'in private');
    choose(s, 'Tell Rıza');
    for (const name of ['Osman', 'Ferda']) {
      choose(s, 'Hear what');
      choose(s, `Ask ${name}`);
    }
    choose(s, 'Write an agreement');
    choose(s, 'cart inside. Smaller');
    choose(s, 'next person');
    choose(s, 'next person');
    choose(s, 'next person');
    choose(s, 'Wait for Rıza');
    // Boundary fixture: the same pending signature with only its displayed minute left.
    s.remaining = 1;
    choose(s, 'next person');
    expect(s.proposal).toBeNull();
    expect(s.remaining).toBe(0);
    expect(s.result).toBe('loss');
    expect(view(s).choices).toEqual([]);
  });
  it('records a confession during the delivery round in actual HF trust and relationships', () => {
    const s = start();
    choose(s, 'in private');
    choose(s, 'Tell Halil');
    choose(s, 'in private');
    choose(s, 'Tell Rıza');
    choose(s, 'Hear what');
    choose(s, 'Ask Osman');
    expect(s.remaining).toBe(18);
    choose(s, 'in private');
    choose(s, 'Withdraw your');
    for (const who of ['halil', 'riza'] as const) {
      expect(reading(s, who).sourceTrust).toBeLessThan(0.8);
      expect(reading(s, who).tie?.trust).toBeLessThan(0.5);
    }
    choose(s, 'Let Osman leave');
    expect(view(s).prose.join(' ')).toContain('check every detail');
    expectReplay(s);
  });
  it('can avoid comparison by releasing Halil after his signed fee waiver', () => {
    const s = start();
    choose(s, 'in private');
    choose(s, 'Tell Halil');
    choose(s, 'in private');
    choose(s, 'Tell Rıza');
    for (const name of ['Osman', 'Ferda']) {
      choose(s, 'Hear what');
      choose(s, `Ask ${name}`);
    }
    choose(s, 'Write an agreement');
    choose(s, 'cart inside. Smaller');
    choose(s, 'next person');
    choose(s, 'Let Halil return');
    sign(s);
    expect(s.result).toBe('win');
    expect(s.spent).toBe(0);
    expect(s.caught).toBe(false);
    expect(reading(s, 'halil').sourceTrust).toBe(0.8);
    expectReplay(s);
  });
  it('does not turn all questions into automatic consent to unsuitable terms', () => {
    const s = start();
    askAll(s);
    choose(s, 'Fetch Nuri');
    choose(s, 'Write an agreement');
    choose(s, 'Full shop lease');
    sign(s);
    expect(s.result).toBe('playing');
    expect(s.proposal?.consents).not.toContain('ferda');
    choose(s, 'End the meeting');
    expect(s.result).toBe('loss');
  });
  it('accepts a successful final signature at the displayed deadline', () => {
    const s = start();
    askAll(s);
    choose(s, 'Fetch Nuri');
    for (let i = 0; i < 2; i++) {
      choose(s, 'Hear what');
      choose(s, 'Ask Halil');
    }
    choose(s, 'Write an agreement');
    choose(s, 'smaller late service');
    sign(s);
    expect(s.result).toBe('win');
    expect(s.remaining).toBe(0);
    expectReplay(s);
  });
  it('ends a refused final signature at the deadline', () => {
    const s = start();
    askAll(s);
    choose(s, 'Fetch Nuri');
    for (let i = 0; i < 2; i++) {
      choose(s, 'Hear what');
      choose(s, 'Ask Halil');
    }
    choose(s, 'Write an agreement');
    choose(s, 'Late work. Use');
    sign(s);
    expect(s.result).toBe('loss');
    expect(s.remaining).toBe(0);
  });
  it('rejects tampered exports and invalid inputs without mutating a run', () => {
    const s = start();
    const before = hashState(s);
    expect(() => act(s, { choice: '999' })).toThrow();
    expect(hashState(s)).toBe(before);
    const run = exportRun(s);
    run.state.remaining = 999;
    expect(() => replayRun(run)).toThrow();
  });
  it('reading Ink twice changes no HF or host state', () => {
    const s = start();
    const before = hashState(s);
    expect(view(s)).toEqual(view(s));
    expect(hashState(s)).toBe(before);
  });
  it('a duplicate signature input is a no-op on the exact proposal', () => {
    const s = start();
    choose(s, 'Write an agreement');
    choose(s, 'Rent an outside');
    const input = { choice: view(s).choices[0]?.id ?? '' };
    act(s, input);
    const signed = hashState(s);
    act(s, input);
    expect(hashState(s)).toBe(signed);
    expect(s.proposal?.consents).toEqual(['halil']);
  });
  it('keeps a long valid navigation log replayable', () => {
    const s = start();
    for (let i = 0; i < 101; i++) {
      choose(s, 'Hear what');
      choose(s, 'Return to the table');
    }
    expectReplay(s);
  });
  it('Ferda acknowledges the order after the letter arrives', () => {
    const s = start();
    choose(s, 'Fetch Nuri');
    choose(s, 'Hear what');
    choose(s, 'Ask Ferda');
    expect(view(s).speech).toContain('order pays');
    expect(view(s).prose.join(' ')).not.toContain('at the depot');
  });
  it('asking every question and fetching the letter leaves four visible minutes after signing', () => {
    const s = start();
    for (const name of ['Halil', 'Rıza', 'Osman', 'Ferda']) {
      choose(s, 'Hear what');
      choose(s, `Ask ${name}`);
    }
    choose(s, 'Fetch Nuri');
    choose(s, 'Write an agreement');
    choose(s, 'smaller late service');
    sign(s);
    expect(s.result).toBe('win');
    expect(s.remaining).toBe(4);
    expectReplay(s);
  });
});

it('rendering an immediate loss leaves the exported state unchanged', () => {
  const s = start();
  choose(s, 'Let Osman leave');
  const before = hashState(s);
  view(s);
  expect(hashState(s)).toBe(before);
});

it('keeps the complete agreement visible after a signature', () => {
  const s = start();
  choose(s, 'Write an agreement');
  choose(s, 'Rent an outside');
  const agreement = s.proposal?.terms;
  choose(s, 'next person');
  expect(view(s).prose.join(' ')).toContain(agreement);
});

it('includes a delivery round that will begin before Rıza can finish signing', () => {
  const s = start();
  choose(s, 'Hear what');
  choose(s, 'Ask Halil');
  choose(s, 'Write an agreement');
  choose(s, 'Rent an outside');
  expect(s.remaining).toBe(20);
  expect(view(s).prose.join(' ')).toContain('11 minutes needed');
});

describe('clarity: why terms and replies change', () => {
  it('names which question shaped the late-work terms, under an unchanged title', () => {
    const s = start();
    choose(s, 'Fetch Nuri');
    choose(s, 'Write an agreement');
    const late = () => view(s).choices.find((c) => c.text.includes('smaller late service'))?.text ?? '';
    const first = late();
    expect(first).toContain('Halil not asked: no paid break');
    expect(first).toContain('Rıza not asked: cart inside overnight');
    choose(s, 'Return to the table');
    choose(s, 'Hear what');
    choose(s, 'Ask Halil');
    choose(s, 'Write an agreement');
    const second = late();
    expect(second).toContain('Halil asked: paid break');
    expect(second).toContain('Rıza not asked: cart inside overnight');
    expect(second).toContain('with a paid break');
    expectReplay(s);
  });
  it('labels Ferda’s fixed line after the letter without changing what is stored', () => {
    const s = start();
    choose(s, 'Hear what');
    choose(s, 'Ask Ferda');
    const before = view(s).prose.join(' ');
    expect(before).toContain('The letter may tell us whether late work pays');
    expect(before).not.toContain('not a reply to the letter');
    choose(s, 'Fetch Nuri');
    choose(s, 'Hear what');
    choose(s, 'Ask Ferda');
    expect(s.note).toContain('The letter may tell us whether late work pays');
    expect(s.log.at(-1)?.text).toContain(s.note);
    expect(view(s).prose.join(' ')).toContain('It is not a reply to the letter');
    expectReplay(s);
  });
  it('refuses the preserved pre-4.17 word-5 export with a fresh-game instruction', () => {
    const raw = gunzipSync(
      readFileSync(new URL('./fixtures/base349-fetchletter-askferda.json.gz', import.meta.url)),
    ).toString();
    expect(() => replayRun(JSON.parse(raw))).toThrow(/another version.*Start a fresh game/);
  });
});

describe('agreement previews before writing', () => {
  it('shows exact late terms, fund cost and unknown acceptance without spending time', () => {
    const s = start();
    choose(s, 'Fetch Nuri');
    choose(s, 'Write an agreement');
    const before = hashState(s);
    const offer = view(s).choices.find((c) => c.text.includes('smaller late service'));
    expect(offer?.text).toContain('without a paid break');
    expect(offer?.text).toContain('inside overnight');
    expect(offer?.text).toContain('Total from your fund: ₺40');
    expect(offer?.text).toContain('acceptance unknown');
    expect(hashState(s)).toBe(before);
    choose(s, 'smaller late service');
    expect(offer?.text).toContain(s.proposal?.terms);
    expect(s.remaining).toBe(16);
    expectReplay(s);
  });
  it('previews asked concessions and known full-lease refusal', () => {
    const s = start();
    askAll(s);
    choose(s, 'Fetch Nuri');
    choose(s, 'Write an agreement');
    const offers = view(s).choices;
    const late = offers.find((c) => c.text.includes('smaller late service'));
    expect(late?.text).toContain('with a paid break');
    expect(late?.text).toContain('takes his cart home at four');
    expect(offers.find((c) => c.text.includes('Late work. Use'))?.text).toContain('Ferda refuses');
    choose(s, 'smaller late service');
    expect(late?.text).toContain(s.proposal?.terms);
  });
  it('warns of the unaffordable deposit and unresolved trial lease before writing', () => {
    const s = start();
    choose(s, 'in private');
    choose(s, 'Tell Halil');
    choose(s, 'in private');
    choose(s, 'Withdraw your');
    choose(s, 'Write an agreement');
    const full = view(s).choices.find((c) => c.text.includes('Rent an outside'));
    expect(full?.text).toContain('₺140');
    expect(full?.text).toContain('You have ₺100');
    expect(full?.text).not.toContain('Ferda refuses');
    const shared = view(s).choices.find((c) => c.text.startsWith('Small repairs'));
    expect(shared?.text).toContain('₺40 deposit');
    expect(shared?.text).not.toContain('You pay nothing.');
    expect(view(s).choices.find((c) => c.text.includes('Morning work. Smaller'))?.text).toContain('Osman');
    const before = s.remaining;
    choose(s, 'Rent an outside');
    expect(s.remaining).toBe(before - 2);
    expect(s.proposal).toBeNull();
    expect(s.note).toContain('₺140');
  });
  it('does not describe a failed meeting as a warm visit to the closed shop', () => {
    const s = start();
    choose(s, 'Hear what');
    choose(s, 'Ask Halil');
    choose(s, 'Let Osman leave');
    expect(view(s).prose.join(' ')).not.toContain('ask you to sit');
    expect(view(s).prose.join(' ')).not.toContain('asks you to sit');
  });
});

describe('HF 4.0 host contract', () => {
  it('refuses a His Word 3.x export before building any run, with a start-fresh message', () => {
    const old = {
      game: 'word',
      edition: 'word-4',
      framework: '3.2.0',
      seed: 1,
      inputs: [],
      state: {},
      hash: '0',
    };
    expect(() => replayRun(old)).toThrow(/earlier version of His Word.*Start a fresh game/);
    const current = exportRun(start());
    expect(() => replayRun({ ...current, archive: { ...current.archive, version: 3 } })).toThrow(
      /earlier version/,
    );
    expect(() => replayRun({ ...current, edition: 'word-6', framework: '4.1.0' })).toThrow(
      /another version of His Word.*Start a fresh game/,
    );
    expect(() => replayRun({ ...current, archive: undefined })).toThrow(/invalid Human Framework record/);
  });
  it('resolves each conversation request once and lets HF replay the archive exactly', () => {
    const s = start();
    askAll(s);
    choose(s, 'Fetch Nuri');
    const { archive } = exportRun(s);
    const settled = archive.current.receipts.communications.map((c) => c.requestId);
    expect(settled).toHaveLength(4);
    expect(new Set(settled).size).toBe(4);
    const inputs = readRunHistory(archive).flatMap((t) => t.inputs);
    expect(inputs.filter((i) => i.kind === 'conversation.requested')).toHaveLength(4);
    expect(inputs.filter((i) => i.kind === 'communication.resolved')).toHaveLength(4);
    const verified = replay(archive);
    expect(verified.ok && verified.value.verified && verified.value.fullHash).toBe(archive.hashes.full);
  });
  it('delivers the letter and private word as attended inputs with their source, never as written beliefs', () => {
    const s = start();
    choose(s, 'in private');
    choose(s, 'Tell Halil');
    choose(s, 'Fetch Nuri');
    const inputs = readRunHistory(exportRun(s).archive).flatMap((t) => t.inputs);
    const percepts = inputs.flatMap((i) => (i.kind === 'observation.received' ? i.payload.percepts : []));
    expect(percepts.map((p) => [p.channel, p.provenance])).toEqual([
      ['told', ['nephew']],
      ['saw', ['supplier-letter']],
    ]);
    expect(percepts[0]?.actorId).toBe('nephew');
    expect(inputs.some((i) => i.kind === 'person.arrived' || i.kind === 'testimony.received')).toBe(false);
    choose(s, 'Hear what');
    choose(s, 'Ask Ferda');
    expect(view(s).speech).toContain('order pays');
  });
  it('sends a confession with no inferred reporter', () => {
    const s = start();
    choose(s, 'in private');
    choose(s, 'Tell Halil');
    choose(s, 'in private');
    choose(s, 'Withdraw your');
    const contradictions = readRunHistory(exportRun(s).archive)
      .flatMap((t) => t.inputs)
      .flatMap((i) => (i.kind === 'contradiction.received' ? [i.payload] : []));
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0]).not.toHaveProperty('reporterId');
    expect(reading(s, 'halil').sourceTrust).toBeLessThan(0.8);
  });
});
