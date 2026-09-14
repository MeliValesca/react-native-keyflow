/** Restore software-keyboard input on a named test emulator, without changing
 * settings on physical devices. This is test setup, never library behavior.
 */
import { execFileSync } from 'node:child_process';
const serial = process.argv[2];
if (!/^emulator-\d+$/.test(serial || ''))
  throw new Error('Supply an explicit emulator serial from stim status');
const adb = process.env.ADB || 'adb';
const run = (...args) =>
  execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8' }).trim();
const before = Object.fromEntries(
  ['show_ime_with_hard_keyboard', 'stylus_handwriting_enabled'].map((key) => [
    key,
    run('shell', 'settings', 'get', 'secure', key),
  ]),
);
const previousKeyboard = run(
  'shell',
  'settings',
  'get',
  'secure',
  'default_input_method',
);
const gboard = run('shell', 'ime', 'list', '-s')
  .split('\n')
  .find((id) => id.startsWith('com.google.android.inputmethod.latin/'));
if (!gboard)
  throw new Error('Install Gboard on the reference emulator before comparing.');
// Text injection tools can select a headless helper IME. Explicitly restore
// the visual reference; an enabled software-keyboard flag alone is insufficient.
run('shell', 'ime', 'enable', gboard);
run('shell', 'ime', 'set', gboard);
run('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1');
run('shell', 'settings', 'put', 'secure', 'stylus_handwriting_enabled', '0');
console.log(
  JSON.stringify(
    {
      serial,
      previous: before,
      previousKeyboard,
      keyboard: run(
        'shell',
        'settings',
        'get',
        'secure',
        'default_input_method',
      ),
      note: 'Reopen the editor. If Gboard is still in handwriting mode, restart its input connection with adb -s <serial> shell ime reset. Keep Floating mode off for screenshot comparisons.',
    },
    null,
    2,
  ),
);
