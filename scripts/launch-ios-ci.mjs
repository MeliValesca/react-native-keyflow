/** Install shared CI products. Local app development continues to use Stim. */
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  appendFileSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function selectRuntime(runtimes, model) {
  const candidates = runtimes.filter(
    (runtime) =>
      runtime.isAvailable &&
      runtime.identifier?.includes('.iOS-') &&
      runtime.supportedDeviceTypes?.some((device) => device.name === model),
  );
  candidates.sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  );
  const runtime = candidates[0];
  if (!runtime) throw new Error(`No available iOS runtime supports ${model}`);
  return {
    runtime: runtime.identifier,
    type: runtime.supportedDeviceTypes.find((device) => device.name === model)
      .identifier,
  };
}

export function installPrebuiltIos(
  model,
  build,
  output,
  { udid, run = execFileSync } = {},
) {
  mkdirSync(output, { recursive: true });
  const outputDirectory = output;
  const command = (...args) => {
    appendFileSync(
      join(output, 'simulator-setup.log'),
      `${JSON.stringify(args)}\n`,
    );
    try {
      const output = run('xcrun', ['simctl', ...args], {
        encoding: 'utf8',
        // Fresh iOS runtimes migrate system data before SpringBoard is ready.
        // Give only first boot extra time; installs and process checks stay bounded.
        timeout: args[0] === 'bootstatus' ? 600_000 : 180_000,
        maxBuffer: 4 * 1024 * 1024,
      });
      if (output)
        appendFileSync(join(outputDirectory, 'simulator-setup.log'), output);
      return output.trim();
    } catch (error) {
      appendFileSync(
        join(outputDirectory, 'simulator-setup.log'),
        `${error.stdout ?? ''}${error.stderr ?? ''}\n${String(error)}\n`,
      );
      throw error;
    }
  };
  const inventory = JSON.parse(command('list', '--json'));
  if (udid) {
    const device = Object.values(inventory.devices)
      .flat()
      .find((entry) => entry.udid === udid);
    if (!device || device.state !== 'Booted')
      throw new Error('Explicit local simulator must already be booted');
  } else {
    const { runtime, type } = selectRuntime(inventory.runtimes, model);
    udid = command('create', `keyflow-ci-${model}`, type, runtime);
    if (!/^[0-9a-f-]{36}$/i.test(udid))
      throw new Error('Invalid created simulator UDID');
    writeFileSync(
      join(output, 'device.json'),
      JSON.stringify({ udid, model, runtime }),
    );
    command('boot', udid);
    command('bootstatus', udid, '-b');
  }
  command('spawn', udid, 'launchctl', 'list');
  command('install', udid, resolve(build, 'Keyflow.app'));
  for (const [key, value] of [
    ['EXDevMenuShowsAtLaunch', 'false'],
    ['EXDevMenuShowFloatingActionButton', 'false'],
    ['EXDevMenuIsOnboardingFinished', 'true'],
  ])
    command(
      'spawn',
      udid,
      'defaults',
      'write',
      'com.keyflow.example',
      key,
      '-bool',
      value,
    );
  writeFileSync(join(output, 'device.json'), JSON.stringify({ udid, model }));
  return udid;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [model, build, output] = process.argv.slice(2);
  if (!model || !build || !output)
    throw new Error(
      'Supply device model, shared build directory, and output directory',
    );
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  if (readFileSync(join(build, 'build-commit.txt'), 'utf8').trim() !== commit)
    throw new Error('Shared build belongs to another commit');
  const xcode = execFileSync('xcodebuild', ['-version'], { encoding: 'utf8' });
  if (readFileSync(join(build, 'xcode-version.txt'), 'utf8') !== xcode)
    throw new Error('Build and test jobs must use the same Xcode version');
  if (process.env.GITHUB_ACTIONS !== 'true' && !process.env.KEYFLOW_IOS_UDID)
    throw new Error(
      'Locally, provide an existing booted KEYFLOW_IOS_UDID from Stim',
    );
  console.log(
    installPrebuiltIos(model, build, output, {
      udid: process.env.KEYFLOW_IOS_UDID,
    }),
  );
}
