/** Finite authored responses. Call only after the corresponding received conversation
 * or completed activity; these lines do not grant knowledge, custody or attendance. */
export type SaturdayDisplay = 'remembered-model' | 'current-model' | 'objects' | 'private';
export function saturdayInvitation() {
  return 'Nora has left a note beneath the garage door: “The low window is still there. There is room for a small table, if we can make it stand properly. Come and look with me before you say yes.”';
}
export function saturdayFirstLook() {
  return 'The folded shelf comes out with a rectangle of pale paint on its back. Nora turns it towards the light. “That side faced the wall. We used to put the better side towards the customers.”';
}
export function saturdaySamSuggestion() {
  return '“Could we put something there that people can use?” Sam turns his stand a quarter turn. “Not just a card saying we fix things. People can work that out.”';
}
export function saturdayShelfObservation(
  kind: 'empty' | 'loaded' | 'underneath' | 'checked' | 'low',
) {
  return {
    empty:
      'Open and empty, the shelf stands level. The two side supports can still fold; the cross-brace is present beneath the top.',
    loaded:
      'With the samples towards one end, a side support creeps inward. You take the load off. Nothing has broken, but standing empty was not enough.',
    underneath:
      'The end of the retained cross-brace sits above its locating stop. Its worn edge is polished where it has been sliding past, rather than bearing against it.',
    checked:
      'The brace stays against its stop through the attended loaded check. You move the samples to the other end and back. Both supports remain planted.',
    low: 'With Nora’s agreement, the folded shelf rests on the existing low counter. It is now a stationary display surface; its folding supports remain unrepaired.',
  }[kind];
}
export function saturdayDisplayResponse(choice: SaturdayDisplay, modelMoves: boolean) {
  switch (choice) {
    case 'remembered-model':
      return `The original paper fronts face the window.${modelMoves ? ' The street makes its slow circuit.' : ' The street stays still, with its unfinished drive labelled honestly.'} Nora leans down to the low window. “I always meant to put a shelf just there. We put boxes there instead.”`;
    case 'current-model':
      return `The newer fronts face the window; the original ones remain in their envelope.${modelMoves ? ' Both views belong to the same moving street.' : ' The street is still unfinished, but the changed fronts are there to see.'} “You kept the narrow doorway,” Nora says. “Everybody remembers the window.”`;
    case 'objects':
      return 'The useful things have space between them. Nora moves the empty label card away from the front. “Let them look first. We can tell them what we did if they ask.”';
    case 'private':
      return 'You leave the arrangement on the garage bench. There is no opening time to meet. Nora brings her chair nearer so she can see the small details without leaning over your hands.';
  }
}
export function saturdayCuriosity(topic: 'old-card' | 'paint' | 'sam') {
  return {
    'old-card':
      'The old card says “A BETTER HIGH STREET” in letters larger than the street itself. Nora smooths one corner. “I remember the cards arriving. I don’t remember anybody asking us about the doorway.” She has no explanation for what happened afterwards.',
    paint:
      '“Was the shelf always this colour?” Nora looks at the pale rectangle. “No. But I couldn’t tell you which colour came first.” She turns it back. “That one has had an easier life.”',
    sam: '“What would you put on the card?” Sam thinks for a moment. “Back tomorrow, probably.” Then he adds, “When that is actually true.”',
  }[topic];
}
export function saturdayHomecoming(choice: SaturdayDisplay, samHere: boolean) {
  return `${choice === 'private' ? 'The afternoon ends where it began, at the bench.' : 'The borrowed display comes down, and the things agreed for return come home.'} ${choice === 'private' ? 'The arrangement stays on the bench for a moment longer.' : 'The garage looks smaller after arranging everything in a window.'}${samHere ? ' Sam looks up as you settle back at the bench. “How did it go?”' : ' The quieter bench gives you a moment to look at the things that came back.'} There is time to leave the tools where they are.`;
}

/** Only after Nora actually agrees and attends. The cloth is one of her retained
 * samples; choosing handling neither transfers ownership nor improves a score. */
export function saturdayHumanUse(context: {
  place: 'window' | 'private';
  handling: boolean;
  samHere: boolean;
}) {
  if (context.place === 'private')
    return 'Nora brings her chair closer. “Show me the bit you would have left out of the window.” There is time to turn things round without deciding how they ought to look from the street. She turns one of her samples over against the plain bench. “I would have put this face down. Look how much of the colour it kept.”';
  if (!context.handling)
    return 'Nora keeps the samples behind the display. She lifts one herself and turns it towards the light, then over. “This was the side your mum chose for the curtains. I kept showing people the other one.” She leaves that side facing out. You can see it clearly without handling it.';
  return `Nora sets one of her samples within reach. “That one is all right to pick up.” You turn it over between your fingers. The reverse is softer and less faded. “That was the side your mum chose,” Nora says. “I kept showing people the other one.”${context.samHere ? ' Sam leans closer. “That’s better than a card telling you what it feels like.”' : ''}`;
}

/** Reply choices contain only this player's completed afternoon. The host still
 * requires an actually completed conversation before either line is received. */
export function saturdayHomeReplies(choice: SaturdayDisplay, clothSeen: boolean) {
  const reflection =
    choice === 'private'
      ? 'I liked having no opening time to meet.'
      : choice === 'remembered-model' || choice === 'current-model'
        ? 'The paper street looked bigger in the window.'
        : 'It was good to give the things room, instead of piling them on the bench.';
  return [
    {
      id: 'talk-sam-saturday-afternoon',
      label: `To Sam: “${reflection}”`,
      player: reflection,
      reply:
        choice === 'private'
          ? 'And no taking it all down just when you’ve got it right.'
          : choice === 'remembered-model' || choice === 'current-model'
            ? 'I’d have put my nose right up to the glass.'
            : 'I’d have liked seeing them with a bit of space. The counter gets like that too.',
    },
    ...(clothSeen
      ? [
          {
            id: 'talk-sam-saturday-cloth',
            label: 'To Sam: “The other side of Nora’s cloth was worth a look.”',
            player:
              'The other side of Nora’s cloth was worth a look. I hadn’t thought about turning it over.',
            reply:
              'I’d probably have missed it too. I turn parcels over all morning and forget to look at the back of anything else.',
          },
        ]
      : []),
    {
      id: 'talk-sam-saturday-private',
      label: 'To Sam: “I’ll tell you another time.”',
      player: 'I’ll tell you another time.',
      reply: 'All right. It’s good to have you back.',
    },
  ];
}
