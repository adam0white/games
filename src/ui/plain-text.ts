/** Clarify historical evidence only at display time. Never change saved or replayed text. */
export function plainText(text: string): string {
  return text
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
