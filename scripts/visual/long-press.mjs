/** Real held-state captures on the Long Press screen. iOS includes every
 * independently recorded accent row; Android includes all letter hints/accents.
 * Usage: node scripts/visual/long-press.mjs ios|android session device
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const [platform, session, device] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !session || !device)
  throw new Error('Supply platform session device');
const agent = process.env.AGENT_DEVICE || 'agent-device';
const adb = process.env.ADB || 'adb';
const selectedLabels = process.argv[5]?.split(',');
const dir = `artifacts/features/${platform}/long-press${
  selectedLabels ? '-focused' : ''
}`;
mkdirSync(dir, { recursive: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (...args) =>
  JSON.parse(
    execFileSync(agent, [...args.map(String), '--session', session, '--json'], {
      encoding: 'utf8',
      timeout: 35000,
    }),
  ).data;
const control = (label) => {
  const n = run('snapshot').nodes.find(
    (n) => n.label === label && n.rect?.y > 90 && n.rect.y < 450,
  );
  if (!n) throw new Error(`Missing ${label}; open Long press tests`);
  run('press', n.rect.x + n.rect.width / 2, n.rect.y + n.rect.height / 2);
};
const positions = {};
for (const [row, letters] of ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].entries()) {
  [...letters].forEach((letter, column) => {
    positions[letter] =
      platform === 'ios'
        ? [
            (row === 0 ? 21 : row === 1 ? 41 : 81) + column * 40,
            [611, 665, 719][row],
          ]
        : [
            (row === 0 ? 22 : row === 1 ? 43 : 82) + column * 40.7,
            [677, 735, 794][row],
          ];
  });
}
positions.space = platform === 'ios' ? [200, 773] : [225, 854];
positions.delete = platform === 'ios' ? [375, 719] : [377, 794];
const fixture = JSON.parse(
  readFileSync('scripts/fixtures/apple-letter-reference.json'),
);
const cases =
  platform === 'ios'
    ? [
        ...Object.entries(fixture.lowercase),
        ...Object.entries(fixture.uppercase).map(([k, v]) => [
          k.toUpperCase(),
          v,
        ]),
      ]
    : [...'qwertyuiopasdfghjklzxcvbnm'].map((k) => [k, null]);
if (platform === 'ios') cases.push(['q', null]);
cases.push(['space', null], ['delete', null]);
if (selectedLabels) {
  if (selectedLabels.some((label) => !cases.some(([key]) => key === label)))
    throw new Error('Unknown focused key');
  cases.splice(
    0,
    cases.length,
    ...cases.filter(([key]) => selectedLabels.includes(key)),
  );
}
const capture = (path) => {
  if (platform === 'ios')
    execFileSync('xcrun', ['simctl', 'io', device, 'screenshot', path], {
      stdio: 'ignore',
    });
  else
    writeFileSync(
      path,
      execFileSync(adb, ['-s', device, 'exec-out', 'screencap', '-p']),
    );
  const png = PNG.sync.read(readFileSync(path));
  if (
    png.width !== (platform === 'ios' ? 1206 : 411) ||
    png.height !== (platform === 'ios' ? 2622 : 914)
  )
    throw new Error('Wrong reference viewport');
  return png;
};
const results = [];
const nativeText = new Map();
try {
  for (const mode of ['native', 'custom']) {
    control(
      mode === 'custom'
        ? 'Keyflow'
        : platform === 'ios'
        ? 'Apple native'
        : 'Android native',
    );
    for (const [label, alternatives] of cases) {
      control(label === 'delete' ? 'Reset Repeat' : 'Reset Empty');
      await pause(600);
      if (label.length === 1 && label !== label.toLowerCase())
        run('press', 31, platform === 'ios' ? 719 : 794);
      const [x, y] = positions[label.toLowerCase()];
      const slug = `${mode}-${
        label === label.toUpperCase() ? 'upper-' : ''
      }${label.toLowerCase()}`;
      const held = `${slug}-held.png`,
        released = `${slug}-released.png`;
      let png;
      if (platform === 'ios') {
        const process = spawn(agent, [
          'longpress',
          String(x),
          String(y),
          '6000',
          '--session',
          session,
        ]);
        const done = new Promise((resolve, reject) => {
          process.on('error', reject);
          process.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`Hold exited ${code}`)),
          );
        });
        await pause(3000);
        png = capture(`${dir}/${held}`);
        await done;
      } else {
        const motion = (action) =>
          execFileSync(adb, [
            '-s',
            device,
            'shell',
            'input',
            'motionevent',
            action,
            String(x),
            String(y),
          ]);
        motion('DOWN');
        try {
          await pause(650);
          png = capture(`${dir}/${held}`);
        } finally {
          motion('UP');
        }
      }
      await pause(250);
      const after = capture(`${dir}/${released}`);
      let changed = 0;
      for (
        let p = Math.floor(png.height * 0.57) * png.width * 4;
        p < png.data.length;
        p += 4
      )
        if (
          [0, 1, 2].some(
            (c) => Math.abs(png.data[p + c] - after.data[p + c]) > 35,
          )
        )
          changed++;
      // Delete has no popup and may reach empty before the capture. Its repeat
      // timing is asserted by compare-native-interactions instead.
      if (label !== 'delete' && changed < 100)
        throw new Error(`${slug}: held visual state missing`);
      const cells = [];
      if (platform === 'ios' && mode === 'custom' && alternatives) {
        const values = [...alternatives],
          selected = values.indexOf(label);
        const unit = Math.min(42, 392 / values.length);
        const start = Math.max(
          5,
          Math.min(x - (selected + 0.5) * unit, 397 - values.length * unit),
        );
        for (let i = 0; i < values.length; i++) {
          let ink = 0;
          const cx = start + (i + 0.5) * unit,
            cy = y - 60;
          for (let py = Math.round((cy - 15) * 3); py < (cy + 15) * 3; py++)
            for (let px = Math.round((cx - 10) * 3); px < (cx + 10) * 3; px++) {
              const offset = (py * png.width + px) * 4,
                rgb = [...png.data.subarray(offset, offset + 3)];
              if (
                i === selected
                  ? rgb.every((v) => v > 210)
                  : rgb.every((v) => v < 85)
              )
                ink++;
            }
          if (ink < 45 || ink > 4500)
            throw new Error(
              `${slug}: invisible accent ${values[i]} (${ink} ink pixels)`,
            );
          cells.push({ letter: values[i], inkPixels: ink });
        }
      }
      const editor = run('snapshot').nodes.find(
        (n) => /TextField|EditText/i.test(n.type) || n.editable,
      );
      const actualText =
        editor?.hintShowing ||
        ['Start typing…', 'Hold a key…'].includes(editor?.value)
          ? ''
          : editor?.value;
      if (actualText === undefined)
        throw new Error(`${slug}: editor state unavailable`);
      if (mode === 'native') nativeText.set(label, actualText);
      else if (
        label === 'delete'
          ? !'abcdefghijklmnop'.startsWith(actualText) || actualText.length > 14
          : actualText !== nativeText.get(label)
      )
        throw new Error(
          `${slug}: release text ${JSON.stringify(
            actualText,
          )} differs from native ${JSON.stringify(nativeText.get(label))}`,
        );
      results.push({
        mode,
        label,
        actualText,
        held,
        released,
        changedPixels: changed,
        cells,
        status: 'PASS',
        visualParity: 'review required',
      });
      writeFileSync(
        `${dir}/results.json`,
        JSON.stringify({ result: 'RUNNING', platform, results }, null, 2),
      );
      console.log(
        `PASS ${slug}: held/released visual evidence${
          cells.length ? `, ${cells.length} visible accents` : ''
        }`,
      );
    }
  }
  control('Keyflow');
  control('Reset Empty');
  writeFileSync(
    `${dir}/results.json`,
    JSON.stringify({ result: 'PASS', platform, results }, null, 2),
  );
} catch (error) {
  writeFileSync(
    `${dir}/results.json`,
    JSON.stringify(
      { result: 'FAIL', platform, results, error: String(error) },
      null,
      2,
    ),
  );
  throw error;
}
