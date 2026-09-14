import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Only known documentation assets skip code checks. Unknown/shared paths run all.
const fullScope = () => ({ ios: true, android: true, library: true });
const documentation = (path) =>
  /\.md$/.test(path) ||
  /^docs\/media\/.*\.(gif|mp4|png|jpe?g|webp|svg)$/.test(path);
export function changeScope(paths) {
  const scope = { ios: false, android: false, library: false };
  if (!paths.length) return fullScope();
  for (const path of paths) {
    if (documentation(path)) continue;
    scope.library = true;
    if (
      /^(ios\/|example\/ios\/|scripts\/ios-tests\/)/.test(path) ||
      /^scripts\/(run-ios-qwerty-tests|launch-ios-ci(?:\.test)?|patch-stim-ios-readiness)\.mjs$/.test(
        path,
      ) ||
      /^scripts\/ci\/(build-ios|run-ios)\.sh$/.test(path) ||
      path === '.github/workflows/ios-ui.yml' ||
      path === '.swift-format'
    ) {
      scope.ios = true;
    } else if (
      /^(android\/|example\/android\/|scripts\/android-tests\/)/.test(path) ||
      path === '.github/workflows/android-ui.yml'
    ) {
      scope.android = true;
    } else {
      return fullScope();
    }
  }
  return scope;
}

export function detectScope(
  event,
  base,
  head,
  diff = (args) => execFileSync('git', args, { encoding: 'utf8' }),
) {
  if (!['pull_request', 'push'].includes(event)) return fullScope();
  if (event === 'push' && /^0{40}$/.test(base ?? '')) return fullScope();
  if (![base, head].every((sha) => /^[a-f0-9]{40}$/.test(sha ?? ''))) {
    throw new Error('Expected full base and head commit SHAs');
  }
  const paths = diff([
    'diff',
    '--name-only',
    '--no-renames',
    '-z',
    `${base}${event === 'pull_request' ? '...' : '..'}${head}`,
  ])
    .split('\0')
    .filter(Boolean);
  return changeScope(paths);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const scope = detectScope(
    process.env.EVENT_NAME,
    process.env.BASE_SHA,
    process.env.HEAD_SHA,
  );
  console.log(scope);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `ios=${scope.ios}\nandroid=${scope.android}\nlibrary=${scope.library}\n`,
  );
}
