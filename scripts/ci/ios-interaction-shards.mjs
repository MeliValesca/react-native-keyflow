import { readFileSync } from 'node:fs';

export function interactionShards(source) {
  const names = [...source.matchAll(/func (test\w+)\(/g)]
    .map((match) => match[1])
    .sort();
  if (!names.length || new Set(names).size !== names.length)
    throw new Error('Missing or duplicate iOS interaction cases');
  return [0, 1].map((shard) => names.filter((_, index) => index % 2 === shard));
}

if (process.argv[1]?.endsWith('/ios-interaction-shards.mjs')) {
  const shard = process.argv[2];
  if (!['0', '1'].includes(shard))
    throw new Error('Expected iPad shard 0 or 1');
  console.log(
    interactionShards(
      readFileSync('scripts/ios-tests/KeyflowQwertyTests.swift', 'utf8'),
    )[Number(shard)].join(' '),
  );
}
