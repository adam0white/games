const descriptions: Record<string, string> = {
  'Power on.': 'The power is on.',
  'Power off.': 'The power is off.',
  'Chapter paused.': 'The workshop is paused.',
  'Chapter resumed.': 'The workshop has resumed.',
  'Promise accepted.': 'You have accepted the promise.',
  'Request declined honestly.': 'You have declined the request honestly.',
  'Returned unfinished.': 'The object was returned unfinished.',
  'Returned to use.': 'The object is back in use.',
  'Recovery finished.': 'The part recovery is finished.',
  'Part added to the tray.': 'The part is now in the tray.',
  'Workshop improved.': 'The workshop improvement is installed.',
  'Request cancelled.': 'The request is cancelled.',
  'Learning session ended.': 'The lesson has ended.',
  'Responsibility recalled.': 'You have taken responsibility back from Sam.',
  'A new workshop morning.': 'A new workshop day has started.',
  'Work completed.': 'The repair step is complete.',
  'No component at that location.': 'There is no component at that location.',
  'Cleaned the cell pack terminals': 'The cell pack terminals were cleaned',
  'Cleaned the switch contact faces': 'The switch contact faces were cleaned',
  'Cleaned the mating contact faces': 'The mating contact faces were cleaned',
  'Cleaned the bulb socket faces': 'The bulb socket faces were cleaned',
  'Removed residue from the motor bearing': 'Residue was removed from the motor bearing',
  'Removed residue from the spring arbor': 'Residue was removed from the spring arbor',
  'Removed residue from the gear teeth': 'Residue was removed from the gear teeth',
  'Cleaned the governor braking surfaces': 'The governor braking surfaces were cleaned',
  'Removed residue from the drum spindle': 'Residue was removed from the drum spindle',
  'Reseated the cell pack in its holder': 'The cell pack was put back in its holder',
  'Retightened the switch mounting and seated its lever':
    'The switch mounting was tightened and its lever was put back in place',
  'Reseated the contact and tightened its clip':
    'The contact was put back in place and its clip was tightened',
  'Reseated the bulb in its socket': 'The bulb was put back in its socket',
  'Centered the motor bearing in its mounting': 'The motor bearing was centered in its mounting',
  'Reseated the spring arbor': 'The spring arbor was put back in place',
  'Reseated the gear on its spindle': 'The gear was put back on its spindle',
  'Moved the governor collar': 'The governor collar was moved',
  'Centered the drum spindle in its mounting': 'The drum spindle was centered in its mounting',
  '; run under load and movement to check the result.':
    '. Run the object under load and while moving it to check the result.',
  'Collar set.': 'The collar is set.',
  'Repair offer held until Sam finishes his current activity.':
    'The repair offer will wait until Sam finishes his current activity.',
  'Evidence retained; not fully checked':
    'The observations are saved. The required use tests are not complete.',
};

/** Clarify historical evidence only at display time. Never change saved or replayed text. */
export function plainText(text: string): string {
  let readable = text;
  for (const [before, after] of Object.entries(descriptions))
    readable = readable.replaceAll(before, after);
  return readable
    .replace(
      /Replaced (.+?)\. Test the object again\./g,
      'The $1 was replaced. Test the object again.',
    )
    .replace(/Set (.+?) collar to (\d+)\./g, 'The $1 collar is set to $2.')
    .replace(/Faster than the last try\./g, 'The tune plays faster than it did on the last try.')
    .replace(/Slower than the last try\./g, 'The tune plays slower than it did on the last try.')
    .replace(
      /About the same as the last try\./g,
      'The tune plays at about the same speed as it did on the last try.',
    )
    .replace(
      /Barely a breath of air (on the table|while carried|under load); not enough\./g,
      'The fan barely moves air $1. It is not strong enough.',
    )
    .replace(
      /Only a faint glow (on the table|while carried|under load); not enough\./g,
      'The light glows faintly $1. It is not bright enough.',
    )
    .replace(
      /Air moves, but weakly, (on the table|while carried|under load); not enough\./g,
      'The fan moves air weakly $1. It is not strong enough.',
    )
    .replace(
      /It lights, but dimly, (on the table|while carried|under load); not enough\./g,
      'The light is dim $1. It is not bright enough.',
    )
    .replace(
      /A strong, steady breeze (on the table|while carried|under load)\./g,
      'The fan produces a strong, steady breeze $1.',
    )
    .replace(
      /A steady breeze (on the table|while carried|under load)\./g,
      'The fan produces a steady breeze $1.',
    )
    .replace(
      /Bright and steady (on the table|while carried|under load)\./g,
      'The light is bright and steady $1.',
    )
    .replace(
      /Steady light (on the table|while carried|under load)\./g,
      'The light stays steady $1.',
    )
    .replace(
      /The drum crawls (on the table|while carried|under load); the melody drags badly\./g,
      'The drum turns very slowly $1. The tune plays much too slowly.',
    )
    .replace(
      /The melody drags a little (on the table|while carried|under load)\./g,
      'The tune plays a little too slowly $1.',
    )
    .replace(
      /The melody drags (on the table|while carried|under load)\./g,
      'The tune plays too slowly $1.',
    )
    .replace(
      /The drum races (on the table|while carried|under load); the melody gallops\./g,
      'The drum turns very quickly $1. The tune plays much too quickly.',
    )
    .replace(
      /The melody hurries a little (on the table|while carried|under load)\./g,
      'The tune plays a little too quickly $1.',
    )
    .replace(
      /The melody hurries (on the table|while carried|under load)\./g,
      'The tune plays too quickly $1.',
    );
}
