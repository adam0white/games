import type { MindFactory } from '../types.ts';

const random: MindFactory = ({ seed }) => {
  const state = { rng: seed >>> 0 };
  return {
    name: 'random',
    step(obs) {
      state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
      const action = obs.actions[Math.floor((state.rng / 4294967296) * obs.actions.length)];
      if (!action) throw new Error('The world supplied no legal actions.');
      return { action: action.id };
    },
    endEpisode() {
      return '';
    },
  };
};

export default random;
