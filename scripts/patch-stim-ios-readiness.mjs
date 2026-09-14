import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Stim 1.2.0 spawns the host macOS `true` binary in an iOS simulator.
// Use launchctl from the simulator runtime to verify launchd can spawn instead.
const root =
  process.argv[2] ??
  join(
    execFileSync('npm', ['root', '--global'], { encoding: 'utf8' }).trim(),
    'stim',
  );
const version = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8'),
).version;
if (version !== '1.2.0')
  throw new Error(`Review readiness workaround for Stim ${version}`);
const dist = join(root, 'dist');
const files = readdirSync(dist).filter((name) => /^xcode-.*\.mjs$/.test(name));
let patched = 0;
for (const file of files) {
  const path = join(dist, file);
  const source = readFileSync(path, 'utf8');
  const probe = /("simctl",\s*"spawn",\s*udid,\s*)"\/usr\/bin\/true"/g;
  const updated = source.replace(probe, (_, prefix) => {
    patched++;
    return `${prefix}"launchctl", "list"`;
  });
  if (updated !== source) writeFileSync(path, updated);
}
if (patched !== 1)
  throw new Error(`Expected one Stim readiness probe, found ${patched}`);
console.log(
  'Patched Stim 1.2.0 iOS readiness probe to simulator launchctl list',
);
