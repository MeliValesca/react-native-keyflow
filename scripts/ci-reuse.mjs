import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function fingerprint(tree, title = '', base = '') {
  const entries = tree
    .split('\0')
    .filter(Boolean)
    .filter((entry) => {
      const path = entry.slice(entry.indexOf('\t') + 1);
      return (
        !/\.md$/.test(path) &&
        !/^docs\/media\/.*\.(gif|mp4|png|jpe?g|webp|svg)$/.test(path)
      );
    });
  return createHash('sha256')
    .update(JSON.stringify([entries.sort(), title, base]))
    .digest('hex');
}

export function eligible(run, current, pr) {
  return (
    run.id < current.id &&
    run.event === 'pull_request' &&
    run.repository?.id === current.repository.id &&
    run.workflow_id === current.workflow_id &&
    run.pull_requests?.some((item) => item.number === pr) &&
    (run.status !== 'completed' || run.conclusion === 'success')
  );
}

export async function waitForSuccess(
  read,
  sleep,
  now = Date.now,
  limit = 130 * 60_000,
) {
  const deadline = now() + limit;
  while (now() < deadline) {
    const run = await read();
    if (run.status === 'completed') return run.conclusion === 'success';
    await sleep(30_000);
  }
  return false;
}

export async function reusableRun(api, runId, pr, key, wait = waitForSuccess) {
  const current = api(`actions/runs/${runId}`);
  const runs = api(
    `actions/workflows/${current.workflow_id}/runs?event=pull_request&per_page=100`,
  ).workflow_runs;
  for (const run of runs.filter((item) => eligible(item, current, pr))) {
    const artifacts = api(
      `actions/runs/${run.id}/artifacts?per_page=100`,
    ).artifacts;
    if (
      !artifacts.some(
        (item) => !item.expired && item.name === `ci-inputs-${key}`,
      )
    )
      continue;
    console.log(`Matching test inputs: ${run.html_url}`);
    const success = await wait(
      () => api(`actions/runs/${run.id}`),
      (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    );
    if (!success) break;
    return run;
  }
  return null;
}

async function main() {
  const env = process.env;
  if (process.argv[2] === 'prepare') {
    const key = fingerprint(
      execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], {
        encoding: 'utf8',
      }),
      env.PR_TITLE,
      env.PR_BASE,
    );
    writeFileSync('/tmp/keyflow-ci-inputs.txt', key + '\n');
    appendFileSync(env.GITHUB_OUTPUT, `key=${key}\n`);
    return;
  }
  if (env.EVENT_NAME !== 'pull_request') return;
  const api = (path) =>
    JSON.parse(
      execFileSync('gh', ['api', `repos/${env.GITHUB_REPOSITORY}/${path}`], {
        encoding: 'utf8',
        timeout: 30_000,
      }),
    );
  try {
    const run = await reusableRun(
      api,
      env.GITHUB_RUN_ID,
      Number(env.PR_NUMBER),
      env.INPUT_KEY,
    );
    if (run) {
      appendFileSync(env.GITHUB_OUTPUT, 'reused=true\n');
      appendFileSync(
        env.GITHUB_STEP_SUMMARY,
        `Reused successful checks for identical code and CI inputs: ${run.html_url}\n`,
      );
    }
  } catch (error) {
    console.warn(
      `Could not verify earlier checks; running tests: ${error.message}`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
