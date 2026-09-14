# Contributing

Install dependencies with `corepack yarn install --immutable`, then run `corepack yarn hooks:install` once per checkout. Before submitting a PR, run `corepack yarn check`. Format TypeScript with `corepack yarn format:write`, Swift with `xcrun swift-format format --in-place ios/*.swift`, and Kotlin with `./gradlew :react-native-keyflow:formatKotlinWrite` from `example/android` after generating the example project.

## Conventions

Use conventional commit messages and PR titles, for example `fix(android): cancel accents outside the popup`, `refactor: separate keyboard layout from gestures`, or `docs: explain theme overrides`. The commit hook validates new messages; CI validates PR titles so squash commits can drive release notes. Existing history is not rewritten.

React Native's ESLint configuration, strict TypeScript, and React Hooks rules apply to the library and example. We keep explicit `void` for intentionally unawaited event-handler promises and allow inline example styles to demonstrate customization. Formatting is checked separately with Prettier, swift-format, and ktfmt.

Keep public exports in `src/index.ts`; test diagnostics belong in the `/testing` entry point. Keep layout construction, positioning, popup interaction, and editor integration in their respective native components. Screen markup should compose controls; device test orchestration belongs in a colocated `use` hook or a testing module. Update documentation when changing behavior or support claims. Do not advertise unimplemented native capabilities.

## Validation

`corepack yarn check` runs formatting, lint, TypeScript, JavaScript tests, CI helper tests, and the package build. Native changes also require the affected native build and device suites. CI runs phone and tablet coverage for the affected platforms. Keep behavior assertions during refactors; do not replace them with snapshots of implementation details.

## Releases

The library is an unpublished preview. Publication is an explicit maintainer action, not an automatic consequence of merging.

1. On the current work branch, start from a clean tree and run `corepack yarn release:prepare patch` (or `minor`/`major`). This updates `package.json` and `CHANGELOG.md` without committing, tagging, pushing, or publishing. Use `--dry-run` to preview.
2. Commit those changes with `chore: prepare release X.Y.Z`, submit a PR, and wait for all required checks before merging.
3. On a clean, up-to-date `main`, an authorized maintainer with npm and GitHub credentials runs `corepack yarn release:publish`. This publishes the already-reviewed version and creates its `vX.Y.Z` tag and GitHub release; it does not bump the version or commit to `main`.

Git-installed development copies should run `corepack yarn build` before use; packaged releases build through `prepack`. Native test sources and example assets are excluded from the npm package.
