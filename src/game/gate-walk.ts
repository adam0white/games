/** A finite shared outing, not a dog-walk duty, repair, lesson or job contract.
 * The host supplies completed, continuously attended activity receipts. */
export interface GateWalkState {
  stage: 'gate' | 'home';
  light: 'daylight' | 'sam-torch';
  startedAt: number;
  until: number;
  samWithPlayer: boolean;
  priorFocus: string | null;
  handling?: 'hanging' | 'held' | 'gate-held' | 'sam-first';
  preference?: 'watch' | 'bring' | 'quiet';
  returnedAt?: number;
}
export interface GateWalkContext {
  available: boolean;
  checkedTorch: boolean;
  joined: boolean;
}
export function gateWalkActions(s: GateWalkState | undefined, c: GateWalkContext) {
  if (!s)
    return c.available
      ? [{ id: 'gate-walk-join', label: 'Walk as far as the gate with Sam', minutes: 3 }]
      : [];
  if (s.stage === 'home') return [];
  const actions = [{ id: 'gate-walk-return', label: 'Head back to the bench', minutes: 3 }];
  if (!c.joined) return actions;
  if (!s.handling)
    actions.unshift(
      ...(s.light === 'sam-torch'
        ? [
            { id: 'gate-walk-hang', label: 'Hang Sam’s torch by its red loop', minutes: 3 },
            { id: 'gate-walk-hold-light', label: 'Hold the light for Sam', minutes: 3 },
          ]
        : [
            {
              id: 'gate-walk-hold-gate',
              label: 'Hold the gate while Sam passes through',
              minutes: 3,
            },
            { id: 'gate-walk-sam-first', label: 'Let Sam go through first', minutes: 3 },
          ]),
    );
  else if (!s.preference)
    actions.unshift(
      { id: 'gate-walk-watch', label: 'To Sam: “Come and have a look.”', minutes: 1 },
      {
        id: 'gate-walk-bring',
        label: 'To Sam: “Bring something you’re curious about.”',
        minutes: 1,
      },
      { id: 'gate-walk-quiet', label: 'To Sam: “Sometimes I like working alone.”', minutes: 1 },
    );
  return actions;
}
export function completeGateChoice(
  s: GateWalkState,
  id: string,
): { speaker: string; text: string }[] {
  const handling: Record<string, NonNullable<GateWalkState['handling']>> = {
    'gate-walk-hang': 'hanging',
    'gate-walk-hold-light': 'held',
    'gate-walk-hold-gate': 'gate-held',
    'gate-walk-sam-first': 'sam-first',
  };
  const picked = handling[id];
  if (picked) {
    s.handling = picked;
    return [
      {
        speaker: 'You',
        text:
          picked === 'hanging'
            ? 'The beam swings across the gate. You steady the red loop against the rail; Sam has both hands free for the latch.'
            : picked === 'held'
              ? 'You lower the beam onto the latch while Sam eases the gate open. His dog noses the gap before either of you is ready.'
              : picked === 'gate-held'
                ? 'You hold the gate clear while Sam and his dog pass. She stops on the other side and looks back for you.'
                : 'Sam eases the gate open and goes through first. You catch it before it swings back; his dog has already chosen the next stretch.',
      },
      ...(picked === 'hanging'
        ? [{ speaker: 'Sam', text: 'See? Proper strap. It just used to be parcel string.' }]
        : []),
      {
        speaker: 'Sam',
        text: 'At the counter I wrap things before I find out what they do. Next time you open something, can I sit with you?',
      },
    ];
  }
  const preference =
    id === 'gate-walk-watch' ? 'watch' : id === 'gate-walk-bring' ? 'bring' : 'quiet';
  s.preference = preference;
  return [
    {
      speaker: 'Sam',
      text:
        preference === 'watch'
          ? 'I’d like that. You needn’t have it all figured out before I come.'
          : preference === 'bring'
            ? 'Something small, then. I promise I’m not arriving with the whole counter.'
            : 'Fair enough. We can still walk. She’s very good at leaving a silence alone.',
    },
  ];
}
export function gateWalkView(s: GateWalkState | undefined, c: GateWalkContext) {
  return {
    stage: s?.stage ?? ('invitation' as const),
    title: 'As far as the gate',
    light: s?.light ?? (c.checkedTorch ? 'sam-torch' : 'daylight'),
    samWithPlayer: s?.stage === 'gate' && c.joined,
    handling: s?.handling,
    preference: s?.preference,
    detail: !s
      ? 'Sam is here. There is time to ask about a short walk; his other plans still matter.'
      : s.stage === 'home'
        ? 'Back at the bench, with your work where you left it.'
        : c.joined
          ? 'Sam is beside you at the gate, away from the bench. His dog’s longer circuit is still ahead.'
          : 'You can head back to the bench.',
    actionIds: gateWalkActions(s, c).map((a) => a.id),
  };
}
