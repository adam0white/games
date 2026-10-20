import { consequenceEvidence, decide } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { Hf2Mind } from '../src/minds/hf2.ts';
import { PERSONA } from '../src/types.ts';
import { apply, createWorld, observe } from '../src/world.ts';

const options = { seed: 1, persona: PERSONA, consequences: true };

describe('HF3 received consequences', () => {
  it('uses attended island testimony to give pick goal value through an immediate placement', () => {
    const mind = new Hf2Mind(options);
    const world = createWorld(1);
    world.me = { ...world.spire };
    world.objects = [{ id: 'cube-1', kind: 'cube', at: { ...world.me }, level: 0 }];
    const obs = observe(world, 'Put cubes on the Spire.');
    obs.actions = obs.actions.filter((a) => a.id === 'pick cube-1');
    const result = mind.step(obs);
    expect(mind.name).toBe('hf3');
    expect(mind.person.agenda.goals[0]?.temporal).toEqual({ halfLifeMinutes: 60 });
    expect(mind.person.prospection?.entries.some((e) => e.sourceId === 'island')).toBe(true);
    expect(result.why).toMatch(/goal:g\d+=0\.\d*[1-9]/);
    expect(mind.person.agenda.goals[0]?.progress).toBe(0);
  });

  it('describes physically legal successors for every target in free and task observations', () => {
    for (const carrying of [null, 'cube-1', 'rock', 'ring'] as const) {
      const mind = new Hf2Mind(options);
      const world = createWorld(1);
      world.objects = [{ id: 'cube-1', kind: 'cube', at: { ...world.me }, level: 0 }];
      world.carrying = carrying;
      if (carrying)
        world.objects = [
          { id: carrying, kind: carrying === 'cube-1' ? 'cube' : carrying, at: null, level: 0 },
        ];
      const obs = observe(world);
      expect(mind.offers(obs)).toEqual(new Hf2Mind({ ...options, consequences: false }).offers(obs));
      mind.step(obs);
      expect(mind.person.agenda.goals).toHaveLength(0);
      const entries = mind.person.prospection?.entries ?? [];
      expect(entries.length).toBeGreaterThan(0);
      const other = new Hf2Mind(options);
      other.step(observe(world, 'Put cubes on the Spire.'));
      expect(other.person.prospection?.entries).toEqual(entries);
      for (const entry of entries) {
        const matching = mind
          .offers(obs)
          .filter(
            (o) =>
              o.action === entry.trigger.action &&
              o.targetId === entry.trigger.targetId &&
              o.placeId === entry.trigger.placeId,
          );
        expect(matching.length).toBeGreaterThan(0);
        for (const offer of matching) {
          const next = apply(world, offer.input).state;
          const destination = entry.successor.placeId?.slice(5).split(',').map(Number) ?? [];
          const dx = (destination[0] ?? 0) - (next.me.x - world.me.x);
          const dy = (destination[1] ?? 0) - (next.me.y - world.me.y);
          const direction =
            dx === 0 && dy === 0 ? 'here' : dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : 'N';
          expect(Math.abs(dx) + Math.abs(dy)).toBeLessThanOrEqual(1);
          expect(observe(next).actions.some((a) => a.id === `place ${direction}`)).toBe(true);
          expect(entry.availableUntil).toBe(entry.receivedAt + 2);
          expect(
            consequenceEvidence(mind.person, offer, entry.receivedAt + 1).entries.find(
              (e) => e.entry.id === entry.id,
            )?.feasible,
          ).toBe(false);
        }
      }
    }
  });

  it('does not route a pick through a distant walk and placement', () => {
    const mind = new Hf2Mind(options);
    const world = createWorld(1);
    world.objects = [{ id: 'cube-1', kind: 'cube', at: { ...world.me }, level: 0 }];
    const obs = observe(world, 'Put cubes on the Spire.');
    obs.actions = obs.actions.filter((a) => a.id === 'pick cube-1');
    expect(mind.step(obs).why).not.toContain('goal:');
  });

  it('gives a carrying move goal value only through a physically reachable placement', () => {
    const mind = new Hf2Mind(options);
    const world = createWorld(1);
    world.me = { x: world.spire.x - 2, y: world.spire.y };
    const row = world.height[world.me.y];
    if (row) row[world.me.x] = 4;
    world.carrying = 'cube-1';
    world.objects = [{ id: 'cube-1', kind: 'cube', at: null, level: 0 }];
    const obs = observe(world, 'Put cubes on the Spire.');
    obs.actions = obs.actions.filter((a) => a.id === 'move E');
    expect(obs.actions).toHaveLength(1);
    expect(mind.step(obs).why).toMatch(/goal:g\d+=0\.\d*[1-9]/);
    expect(mind.person.agenda.goals[0]?.progress).toBe(0);
  });

  it('keeps hf2 as the consequence ablation', () => {
    const mind = new Hf2Mind({ ...options, consequences: false });
    const world = createWorld(1);
    mind.step(observe(world, 'Put cubes on the Spire.'));
    expect(mind.name).toBe('hf2');
    expect(mind.person.prospection).toBeUndefined();
    expect(mind.person.agenda.goals[0]?.temporal).toBeUndefined();
    expect(decide(mind.person, mind.offers(observe(world))).considered.length).toBeGreaterThan(0);
  });
});
