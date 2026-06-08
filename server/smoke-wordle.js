// Direct unit smoke for evaluateGuess. Covers the tricky duplicate-letter
// cases. Each expected array is hand-traced from the standard Wordle rules.

const { evaluateGuess } = require('./dist/wordle');

const cases = [
  // All-correct
  ['crane', 'crane', ['correct', 'correct', 'correct', 'correct', 'correct']],

  // PLANT vs CRANE:
  //  P/C absent · L/R absent · A/A correct · N/N correct · T/E absent
  ['plant', 'crane', ['absent', 'absent', 'correct', 'correct', 'absent']],

  // SPEED vs ABIDE: duplicate-letter case.
  //  S/A absent · P/B absent · E/I → E in answer (pos 4) once → present
  //  E/D → second E, only one E left in answer pool → absent
  //  D/E → D in answer (pos 3) → present
  ['speed', 'abide', ['absent', 'absent', 'present', 'absent', 'present']],

  // ROBOT vs BOOST: another duplicate case.
  //  R/B absent · O/O correct · B/O → B left in pool → present
  //  O/S → second O still in pool (pos 2 of answer) → present · T/T correct
  ['robot', 'boost', ['absent', 'correct', 'present', 'present', 'correct']],

  // No letters in common
  ['xyzzy', 'crane', ['absent', 'absent', 'absent', 'absent', 'absent']],

  // ALLEY vs LEVEL — answer has TWO Ls (pos 0 and pos 4) so both Ls in the
  // guess get a present.
  //  A/L absent · L/E present · L/V present · E/E correct · Y/L absent
  ['alley', 'level', ['absent', 'present', 'present', 'correct', 'absent']],
];

let failed = 0;
for (const [guess, answer, expected] of cases) {
  const got = evaluateGuess(guess, answer);
  const match = JSON.stringify(got) === JSON.stringify(expected);
  if (!match) {
    failed += 1;
    console.error(`✗ ${guess} vs ${answer}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(got)}`);
  } else {
    console.log(`✓ ${guess} vs ${answer} → ${got.join(', ')}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log('\n✔  all wordle cases pass');
