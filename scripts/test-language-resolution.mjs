import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'keyflow-languages-'));
try {
  execFileSync(
    'swiftc',
    [
      '-module-cache-path',
      join(dir, 'cache'),
      'ios/KeyflowLanguage.swift',
      'scripts/language-tests/main.swift',
      '-o',
      join(dir, 'test'),
    ],
    { stdio: 'inherit' },
  );
  execFileSync(join(dir, 'test'), { stdio: 'inherit' });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
