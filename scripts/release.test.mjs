import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
test('release preparation updates version and changelog without committing or tagging', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'keyflow-release-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: fixture,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  try {
    symlinkSync(
      join(root, 'node_modules'),
      join(fixture, 'node_modules'),
      'dir',
    );
    writeFileSync(
      join(fixture, 'package.json'),
      JSON.stringify({ name: 'keyflow-release-fixture', version: '0.1.0' }),
    );
    writeFileSync(join(fixture, '.gitignore'), 'node_modules\n');
    const config = JSON.parse(
      readFileSync(join(root, '.release-it.json'), 'utf8'),
    );
    // The fixture has no remote; all release mutations retain the real settings.
    config.git.requireUpstream = false;
    writeFileSync(join(fixture, '.release-it.json'), JSON.stringify(config));
    git('init', '-b', 'release-fixture');
    git('config', 'user.name', 'Keyflow tests');
    git('config', 'user.email', 'tests@example.invalid');
    git('config', 'commit.gpgSign', 'false');
    git('config', 'core.hooksPath', join(fixture, 'no-hooks'));
    git('add', '.');
    git('commit', '-m', 'feat: introduce customizable keys');
    const before = git('rev-parse', 'HEAD');
    execFileSync(
      process.execPath,
      [
        join(root, 'node_modules/release-it/bin/release-it.js'),
        'patch',
        '--ci',
      ],
      {
        cwd: fixture,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000,
      },
    );
    assert.equal(
      JSON.parse(readFileSync(join(fixture, 'package.json'), 'utf8')).version,
      '0.1.1',
    );
    assert.match(
      readFileSync(join(fixture, 'CHANGELOG.md'), 'utf8'),
      /introduce customizable keys/,
    );
    assert.equal(git('rev-parse', 'HEAD'), before);
    assert.equal(git('tag', '--list').trim(), '');
    assert.equal(config.npm.publish, false);
    assert.equal(config.github.release, false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

for (const [message, accepted] of [
  ['fix(android): cancel accents outside the popup', true],
  ['WIP', false],
]) {
  test(`commit convention ${
    accepted ? 'accepts' : 'rejects'
  }: ${message}`, () => {
    const result = spawnSync(
      process.execPath,
      [join(root, 'node_modules/@commitlint/cli/cli.js')],
      {
        cwd: root,
        input: `${message}\n`,
        encoding: 'utf8',
      },
    );
    assert.equal(result.status === 0, accepted, result.stderr || result.stdout);
  });
}
