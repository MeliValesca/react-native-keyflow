import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const target = resolve(process.argv[2] || 'artifacts/keyflow-example-repo');
if (existsSync(target))
  throw new Error(`Choose a new output directory: ${target}`);
mkdirSync(`${target}/vendor`, { recursive: true });
execFileSync(
  'corepack',
  ['yarn', 'pack', '--out', `${target}/vendor/react-native-keyflow.tgz`],
  { stdio: 'inherit' },
);
for (const file of [
  'src',
  'assets',
  'modules',
  'App.tsx',
  'index.ts',
  'app.json',
  'babel.config.cjs',
  'README.md',
]) {
  if (existsSync(`example/${file}`))
    cpSync(`example/${file}`, `${target}/${file}`, { recursive: true });
}
const pkg = JSON.parse(readFileSync('example/package.json', 'utf8'));
pkg.dependencies['react-native-keyflow'] =
  'file:vendor/react-native-keyflow.tgz';
pkg.packageManager = 'yarn@4.11.0';
pkg.devDependencies.typescript = JSON.parse(
  readFileSync('package.json', 'utf8'),
).devDependencies.typescript;
delete pkg.expo;
writeFileSync(`${target}/package.json`, JSON.stringify(pkg, null, 2) + '\n');
writeFileSync(
  `${target}/tsconfig.json`,
  JSON.stringify(
    { extends: 'expo/tsconfig.base', compilerOptions: { strict: true } },
    null,
    2,
  ),
);
writeFileSync(
  `${target}/metro.config.cjs`,
  "module.exports = require('expo/metro-config').getDefaultConfig(__dirname);\n",
);
writeFileSync(`${target}/yarn.lock`, '');
writeFileSync(`${target}/.yarnrc.yml`, 'nodeLinker: node-modules\n');
writeFileSync(
  `${target}/.gitignore`,
  'node_modules/\n.yarn/\n.expo/\nios/\nandroid/\n',
);
execFileSync('git', ['init', '--quiet', target]);
console.log(`Standalone example repository: ${target}`);
