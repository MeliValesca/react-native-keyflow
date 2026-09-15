import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
const workflow = parse(readFileSync('.github/workflows/native.yml', 'utf8'));
const jobs = workflow.jobs;

test('each device consumes the artifact from its required single platform producer', () => {
  for (const platform of ['android', 'ios']) {
    const producer = jobs[platform];
    const consumer = jobs[`${platform}-interactions`];
    assert.ok(
      consumer.needs.includes(platform),
      'Device job must wait for its build',
    );
    assert.ok(
      producer.if.includes(`needs.scope.outputs.${platform} != 'false'`),
      'Only an explicit unaffected scope may skip a build',
    );
    const artifact = `${platform}-test-build`;
    const uploads = producer.steps.filter(
      (step) =>
        step.uses?.startsWith('actions/upload-artifact') &&
        step.with.name === artifact,
    );
    const downloads = consumer.steps.filter(
      (step) =>
        step.uses?.startsWith('actions/download-artifact') &&
        step.with.name === artifact,
    );
    assert.equal(uploads.length, 1);
    assert.equal(downloads.length, 1);
    assert.equal(uploads[0].with['if-no-files-found'], 'error');
    assert.match(
      downloads[0].if,
      new RegExp(`needs\\.${platform}\\.result == 'success'`),
    );
    assert.ok(
      consumer.steps.some(
        (step) =>
          step.name === 'Require successful shared build' &&
          step.run === 'exit 1',
      ),
    );
    const commands = consumer.steps
      .map((step) => step.run ?? step.with?.script ?? '')
      .join('\n');
    assert.doesNotMatch(
      commands,
      /gradlew|expo prebuild|pod install|stim ios|build-ios\.sh/,
    );
    assert.ok(
      !producer.steps.some((step) => step.uses?.includes('emulator-runner')),
    );
  }
});

test('all protected build and device check names remain present', () => {
  const names = [jobs.android.name, jobs.ios.name];
  for (const platform of ['android', 'ios']) {
    const job = jobs[`${platform}-interactions`];
    const matrices = [...job.strategy.matrix.include.matchAll(/'(\[.*?\])'/g)];
    const regular = JSON.parse(matrices.at(-1)[1]);
    names.push(
      ...regular.map(({ label }) =>
        job.name.replace('${{ matrix.label }}', label),
      ),
    );
  }
  assert.deepEqual(
    names.sort(),
    [
      'Android unit tests, lint, and example build',
      'iOS example build',
      'Android phone interactions, pads, holds, and layouts',
      'Android tablet interactions, pads, holds, and layouts',
      'iPhone interactions, layouts, holds, and rotation',
      'iPad interactions, layouts, holds, and rotation',
    ].sort(),
  );
});

test('PR and weekly device suites have one native workflow trigger', () => {
  const nativeWorkflows = readdirSync('.github/workflows').filter((name) => {
    const contents = readFileSync(`.github/workflows/${name}`, 'utf8');
    return /scripts\/ci\/build-ios.sh|reactivecircus\/android-emulator-runner|scripts\/launch-ios-ci/.test(
      contents,
    );
  });
  assert.deepEqual(nativeWorkflows, ['native.yml']);
  assert.ok(
    workflow.on.pull_request !== undefined || 'pull_request' in workflow.on,
  );
  assert.equal(workflow.on.schedule.length, 1);
});

test('prebuilt runners cannot fall back to compiling missing artifacts', () => {
  const android = readFileSync(
    'scripts/android-tests/run-prebuilt-ci.sh',
    'utf8',
  );
  const ios = readFileSync('scripts/ci/run-ios.sh', 'utf8');
  assert.doesNotMatch(android, /gradlew|assembleDebug|expo prebuild/);
  assert.match(android, /build-commit\.txt/);
  assert.match(ios, /xcodebuild test-without-building/);
  assert.match(ios, /KEYFLOW_IOS_XCTESTRUN/);
  assert.match(
    readFileSync('scripts/run-ios-qwerty-tests.mjs', 'utf8'),
    /Missing shared XCTest bundle/,
  );
});

test('device coverage has no optional mode or hidden filters', () => {
  assert.equal(workflow.on.workflow_dispatch, null);
  assert.equal(workflow.env?.KEYFLOW_TEST_SUITE, undefined);
  for (const file of [
    'scripts/ci/run-ios.sh',
    'scripts/run-ios-qwerty-tests.mjs',
    'scripts/android-tests/instrumentation.py',
  ]) {
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /KEYFLOW_TEST_SUITE|selectedTests|extended_tests/,
    );
  }
});

test('iPad held-key cases stay isolated while phone cases share launches', () => {
  const source = readFileSync(
    'scripts/ios-tests/KeyflowQwertyTests.swift',
    'utf8',
  );
  assert.doesNotMatch(source, /func testAccentCataloguesFit\(/);
  assert.match(source, /func testPhoneAccentCataloguesFit\(/);
  assert.match(source, /func testTabletAccentCatalogueAFits\(/);
  assert.match(source, /func testTabletAccentCatalogueUppercaseSFits\(/);

  const runner = readFileSync('scripts/run-ios-qwerty-tests.mjs', 'utf8');
  assert.match(runner, /'-test-timeouts-enabled',\s*'YES'/);
  assert.match(runner, /'-maximum-test-execution-time-allowance',\s*'240'/);
  assert.equal(jobs['ios-interactions']['timeout-minutes'], 45);
});

test('device sources contain the proven inventory plus glyph and Shift regressions', () => {
  const baseline = JSON.parse(
    readFileSync('scripts/ci/baseline-tests.json', 'utf8'),
  );
  for (const [group, file] of [
    ['iosInteractions', 'scripts/ios-tests/KeyflowQwertyTests.swift'],
    ['iosRendering', 'scripts/ios-tests/KeyflowRenderingTests.swift'],
  ]) {
    const actual = [
      ...readFileSync(file, 'utf8').matchAll(/func (test\w+)\(/g),
    ].map((match) => match[1]);
    const regressions =
      group === 'iosRendering'
        ? [
            'testPanelCoversBottomCornersWithoutExtraOpacity',
            'testMultilineCursorMovesAcrossVisualLinesAndEmoji',
            'testTrackpadEmitsBothCursorAxes',
            'testAccentPresentationRespectsHapticsSetting',
            'testWideAccentUsesOnlyPopupSelectionHighlight',
            'testPhoneDoubleShiftLocksCaseAndShowsLockGlyph',
            'testSpacePressChangesDefaultFillAndRestoresOnRelease',
            'testSpacePressRestoresCustomFillOnCancellation',
            'testSpaceTrackpadSoftensFacesAndRestoresCustomColors',
            'testTabletDollarHoldCommitsInitialChoiceWithoutDrag',
            'testSpaceTrackpadLegendsFadeOnEntry',
            'testSpaceTrackpadReleaseRestoresLegendsDuringFade',
            'testSpaceTrackpadCancellationRestoresLegends',
            'testHeldDeleteStopsOnRelease',
            'testHeldDeleteStopsOnCancellation',
            'testHeldDeleteStopsOutsideKey',
            'testTabletShiftedCommaDisplaysAndInsertsExclamation',
            'testTabletShiftedPeriodDisplaysAndInsertsQuestion',
            'testTabletCapsLockClearsManualShift',
            'testTabletShiftTurnsCapsLockOff',
          ]
        : ['testMultilineEditorSupportsReturnAndVerticalTrackpad'];
    assert.deepEqual(
      actual.sort(),
      [...baseline[group], ...regressions].sort(),
    );
  }
  const directory = 'android/src/androidTest/java/com/keyflow';
  const actual = readdirSync(directory)
    .filter((name) => name.endsWith('Test.kt'))
    .flatMap((name) => {
      const code = readFileSync(`${directory}/${name}`, 'utf8');
      return [...code.matchAll(/@Test\s+fun (\w+)\(/g)].map(
        (match) => `com.keyflow.${name.slice(0, -3)}#${match[1]}`,
      );
    });
  const regressions = [
    'multilineCursorPreservesColumnAndMovesOnBothAxes',
    'phoneDoubleShiftLocksCaseAndShowsDistinctGlyph',
    'leftShiftFillsArrowsUntilOneLetterIsTyped',
    'rightShiftFillsArrowsUntilOneLetterIsTyped',
    'tabletAutomaticCapitalizationSelectsCapsInsteadOfShift',
    'tabletCapsThenShiftRemainSelected',
    'tabletShiftThenCapsRemainSelected',
    'shiftedCommaDisplaysAndInsertsPlatformValue',
    'shiftedPeriodDisplaysAndInsertsPlatformValue',
    'spaceTrackpadKeepsPressedColorUntilRelease',
    'raisedSpaceTrackpadKeepsPressedColor',
    'spaceTrackpadCancellationRestoresColor',
    'flatPressedGlyphActuallyRenders',
    'raisedPressedGlyphActuallyRenders',
    'flatRestingGlyphActuallyRenders',
    'raisedRestingGlyphActuallyRenders',
  ].map((name) => `com.keyflow.KeyflowPressFeedbackTest#${name}`);
  assert.deepEqual(
    actual.sort(),
    [...baseline.androidInstrumentation, ...regressions].sort(),
  );
});

test('library checks skip only an explicitly unaffected scope and retain their protected name', () => {
  const library = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
  assert.equal(library.jobs.scope.uses, './.github/workflows/change-scope.yml');
  assert.equal(library.jobs.check.needs, 'scope');
  assert.equal(library.jobs.check.name, 'Format, types, tests, and package');
  assert.match(library.jobs.check.if, /needs.scope.result != 'success'/);
  assert.match(library.jobs.check.if, /needs.scope.outputs.library != 'false'/);
});
test('scope passes event-specific base and head for PRs and main pushes', () => {
  const scope = parse(
    readFileSync('.github/workflows/change-scope.yml', 'utf8'),
  );
  assert.equal(scope.jobs.scope.steps[0].with['fetch-depth'], 0);
  const detect = scope.jobs.scope.steps.find((step) => step.id === 'detect');
  assert.match(detect.env.BASE_SHA, /github.event.before/);
  assert.match(detect.env.BASE_SHA, /github.event.pull_request.base.sha/);
  assert.match(detect.env.HEAD_SHA, /github.event.pull_request.head.sha/);
  assert.match(detect.env.HEAD_SHA, /github.sha/);
  for (const key of ['ios', 'android', 'library']) {
    assert.ok(scope.on.workflow_call.outputs[key]);
    assert.ok(scope.jobs.scope.outputs[key]);
  }
});

for (const file of ['ci.yml', 'native.yml']) {
  test(`${file}: newer runs cannot cancel matching checks being reused`, () => {
    const workflow = parse(readFileSync(`.github/workflows/${file}`, 'utf8'));
    assert.equal(
      workflow.concurrency.group,
      '${{ github.workflow }}-${{ github.run_id }}',
    );
    assert.equal(workflow.concurrency['cancel-in-progress'], false);
    assert.equal(workflow.permissions.actions, 'read');
  });
}

test('reuse is verified before affected platforms can be skipped', () => {
  const scope = parse(
    readFileSync('.github/workflows/change-scope.yml', 'utf8'),
  );
  const steps = scope.jobs.scope.steps;
  assert.ok(
    steps.findIndex((step) => step.id === 'reuse') <
      steps.findIndex((step) => step.id === 'detect'),
  );
  assert.equal(
    steps.find((step) => step.id === 'detect').env.REUSED,
    '${{ steps.reuse.outputs.reused }}',
  );
  assert.match(
    steps.find((step) => step.id === 'detect').run,
    /node scripts\/ci-scope.mjs/,
  );
});
