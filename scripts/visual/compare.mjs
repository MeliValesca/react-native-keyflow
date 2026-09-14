/** Compare a current state against an explicitly chosen, reviewed baseline.
 * This command never creates or updates baselines. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { compareKeyboardPixels } from './pixels.mjs';
const [referencePath, currentPath, directory] = process.argv.slice(2);
if (!referencePath || !currentPath || !directory)
  throw new Error('Supply reviewed-reference.png current.png output-directory');
const reference = PNG.sync.read(readFileSync(referencePath)),
  current = PNG.sync.read(readFileSync(currentPath));
const { diff, ...metrics } = compareKeyboardPixels(reference, current);
mkdirSync(directory, { recursive: true });
writeFileSync(
  `${directory}/diff.png`,
  PNG.sync.write({
    width: current.width,
    height: current.height,
    data: Buffer.from(diff),
  }),
);
writeFileSync(
  `${directory}/result.json`,
  JSON.stringify({ referencePath, currentPath, ...metrics }, null, 2),
);
console.log(metrics);
if (!metrics.pass) process.exitCode = 1;
