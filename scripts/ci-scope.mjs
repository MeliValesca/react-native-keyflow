import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Unknown/shared paths deliberately run both platforms.
export function changeScope(paths) {
  const scope = { ios: false, android: false };
  if (!paths.length) return { ios: true, android: true };
  for (const path of paths) {
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
      return { ios: true, android: true };
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
  if (event !== 'pull_request') return { ios: true, android: true };
  if (![base, head].every((sha) => /^[a-f0-9]{40}$/.test(sha ?? ''))) {
    throw new Error('Expected full PR base and head commit SHAs');
  }
  const paths = diff([
    'diff',
    '--name-only',
    '--no-renames',
    '-z',
    `${base}...${head}`,
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
    `ios=${scope.ios}\nandroid=${scope.android}\n`,
  );
}
