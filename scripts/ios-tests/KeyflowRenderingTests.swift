import XCTest
import UIKit

final class KeyflowRenderingTests: XCTestCase {
  func testDefaultFlatSmallSquareFits() { assertFits("default", "flat", 12.0, 0.0) }
  func testDefaultFlatSmallRoundedFits() { assertFits("default", "flat", 12.0, 24.0) }
  func testDefaultFlatLargeSquareFits() { assertFits("default", "flat", 32.0, 0.0) }
  func testDefaultFlatLargeRoundedFits() { assertFits("default", "flat", 32.0, 24.0) }
  func testDefaultRaisedSmallSquareFits() { assertFits("default", "raised", 12.0, 0.0) }
  func testDefaultRaisedSmallRoundedFits() { assertFits("default", "raised", 12.0, 24.0) }
  func testDefaultRaisedLargeSquareFits() { assertFits("default", "raised", 32.0, 0.0) }
  func testDefaultRaisedLargeRoundedFits() { assertFits("default", "raised", 32.0, 24.0) }
  func testNumberPadFlatSmallSquareFits() { assertFits("number-pad", "flat", 12.0, 0.0) }
  func testNumberPadFlatSmallRoundedFits() { assertFits("number-pad", "flat", 12.0, 24.0) }
  func testNumberPadFlatLargeSquareFits() { assertFits("number-pad", "flat", 32.0, 0.0) }
  func testNumberPadFlatLargeRoundedFits() { assertFits("number-pad", "flat", 32.0, 24.0) }
  func testNumberPadRaisedSmallSquareFits() { assertFits("number-pad", "raised", 12.0, 0.0) }
  func testNumberPadRaisedSmallRoundedFits() { assertFits("number-pad", "raised", 12.0, 24.0) }
  func testNumberPadRaisedLargeSquareFits() { assertFits("number-pad", "raised", 32.0, 0.0) }
  func testNumberPadRaisedLargeRoundedFits() { assertFits("number-pad", "raised", 32.0, 24.0) }
  func testDecimalPadFlatSmallSquareFits() { assertFits("decimal-pad", "flat", 12.0, 0.0) }
  func testDecimalPadFlatSmallRoundedFits() { assertFits("decimal-pad", "flat", 12.0, 24.0) }
  func testDecimalPadFlatLargeSquareFits() { assertFits("decimal-pad", "flat", 32.0, 0.0) }
  func testDecimalPadFlatLargeRoundedFits() { assertFits("decimal-pad", "flat", 32.0, 24.0) }
  func testDecimalPadRaisedSmallSquareFits() { assertFits("decimal-pad", "raised", 12.0, 0.0) }
  func testDecimalPadRaisedSmallRoundedFits() { assertFits("decimal-pad", "raised", 12.0, 24.0) }
  func testDecimalPadRaisedLargeSquareFits() { assertFits("decimal-pad", "raised", 32.0, 0.0) }
  func testDecimalPadRaisedLargeRoundedFits() { assertFits("decimal-pad", "raised", 32.0, 24.0) }
  func testPhonePadFlatSmallSquareFits() { assertFits("phone-pad", "flat", 12.0, 0.0) }
  func testPhonePadFlatSmallRoundedFits() { assertFits("phone-pad", "flat", 12.0, 24.0) }
  func testPhonePadFlatLargeSquareFits() { assertFits("phone-pad", "flat", 32.0, 0.0) }
  func testPhonePadFlatLargeRoundedFits() { assertFits("phone-pad", "flat", 32.0, 24.0) }
  func testPhonePadRaisedSmallSquareFits() { assertFits("phone-pad", "raised", 12.0, 0.0) }
  func testPhonePadRaisedSmallRoundedFits() { assertFits("phone-pad", "raised", 12.0, 24.0) }
  func testPhonePadRaisedLargeSquareFits() { assertFits("phone-pad", "raised", 32.0, 0.0) }
  func testPhonePadRaisedLargeRoundedFits() { assertFits("phone-pad", "raised", 32.0, 24.0) }

  func testWideAccentUsesOnlyPopupSelectionHighlight() throws {
    try withAccentPopup(value: "a") { keyboard, touch, choices, indicator in
      let wide = try XCTUnwrap(choices.first { $0.caption.lowercased() == "æ" })
      let originalSize = indicator.bounds.size
      for material in ["flat", "raised"] {
        var theme = keyboard.theme
        theme.material = material
        theme.background = "#163B50"
        theme.keyBackground = "#163B50"
        theme.selectedKeyBackground = "#327F8D"
        keyboard.theme = theme
        touch.point = CGPoint(x: wide.frame.midX, y: wide.frame.midY)
        keyboard.touchesMoved([touch], with: nil)
        XCTAssertTrue(wide.isPressed)
        XCTAssertEqual(wide.face.backgroundColor, UIColor.clear, "The indicator must be the only accent fill")
        XCTAssertEqual(wide.face.layer.shadowOpacity, 0)
        XCTAssertEqual(wide.face.transform, .identity)
        XCTAssertEqual(indicator.bounds.size, originalSize, "Wide letters must not deform the highlight")
        XCTAssertEqual(indicator.center, wide.center)
      }
      keyboard.layoutIfNeeded()
      let image = UIGraphicsImageRenderer(size: CGSize(width: keyboard.bounds.width, height: keyboard.bounds.height + 160)).image { context in
        context.cgContext.translateBy(x: 0, y: 160)
        keyboard.layer.render(in: context.cgContext)
      }
      let attachment = XCTAttachment(image: image)
      attachment.name = "wide-accent-single-highlight"
      attachment.lifetime = .keepAlways
      add(attachment)
    }
  }

  func testAccentHighlightStaysCenteredWithinChoice() throws {
    try withAccentPopup { keyboard, touch, choices, indicator in
      let choice = choices[1]
      for fraction: CGFloat in [0.15, 0.5, 0.85] {
        touch.point = CGPoint(x: choice.frame.minX + choice.frame.width * fraction, y: choice.frame.midY)
        keyboard.touchesMoved([touch], with: nil)
        XCTAssertTrue(choice.isPressed)
        XCTAssertEqual(indicator.center.x, choice.frame.midX, accuracy: 0.01, "The iOS highlight must not follow the finger within an accent")
        XCTAssertTrue(indicator.layer.animationKeys()?.isEmpty ?? true)
      }
    }
  }

  func testAccentHighlightSwitchesImmediatelyAtBoundary() throws {
    try withAccentPopup { keyboard, touch, choices, indicator in
      let left = choices[1], right = choices[2]
      for (x, expected) in [(left.frame.maxX - 0.1, left), (right.frame.minX + 0.1, right)] {
        touch.point = CGPoint(x: x, y: expected.frame.midY - 5)
        keyboard.touchesMoved([touch], with: nil)
        XCTAssertEqual(choices.filter(\.isPressed).count, 1)
        XCTAssertTrue(expected.isPressed)
        XCTAssertEqual(indicator.center.x, expected.frame.midX, accuracy: 0.01, "Switch immediately; do not interpolate between accents")
        XCTAssertTrue(indicator.layer.animationKeys()?.isEmpty ?? true)
      }
      let image = UIGraphicsImageRenderer(bounds: keyboard.bounds.insetBy(dx: 0, dy: -100)).image { context in
        keyboard.layer.render(in: context.cgContext)
      }
      let attachment = XCTAttachment(image: image)
      attachment.name = "ios-accent-snapped-selection"
      attachment.lifetime = .keepAlways
      add(attachment)
    }
  }

  func testAccentHighlightReentrySnapsAndCommitsChoice() throws {
    try withAccentPopup { keyboard, touch, choices, indicator in
      // iPad includes the popup padding in its hit area; iPhone uses the cells.
      // Probe one point beyond the actual edge, not inside iPad's padding.
      let popup = try XCTUnwrap(keyboard.subviews.compactMap { $0 as? KeyflowCallout }.first { !$0.isHidden })
      let edge = UIDevice.current.userInterfaceIdiom == .pad ? popup.frame.minX : choices[0].frame.minX
      touch.point = CGPoint(x: edge - 1, y: choices[0].frame.midY)
      keyboard.touchesMoved([touch], with: nil)
      XCTAssertTrue(indicator.isHidden)
      XCTAssertFalse(choices.contains(where: \.isPressed))
      let choice = choices[2]
      touch.point = CGPoint(x: choice.frame.minX + choice.frame.width * 0.2, y: choice.frame.midY)
      keyboard.touchesMoved([touch], with: nil)
      XCTAssertFalse(indicator.isHidden)
      XCTAssertEqual(indicator.center.x, choice.frame.midX, accuracy: 0.01)
      var action: KeyflowAction?
      keyboard.onAction = { action = $0 }
      keyboard.touchesEnded([touch], with: nil)
      XCTAssertEqual(action, choice.action)
    }
  }

  func testPhoneDoubleShiftLocksCaseAndShowsLockGlyph() throws {
    try XCTSkipIf(UIDevice.current.userInterfaceIdiom == .pad, "iPhone combined Shift/Caps control")
    let keyboard = KeyflowKeyboardView()
    keyboard.updateViewport(UIScreen.main.bounds.size, insets: .zero)
    keyboard.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: keyboard.intrinsicContentSize.height)
    keyboard.layoutIfNeeded()
    keyboard.updateContext("word")
    let keys = keyboard.subviews.compactMap { $0 as? KeyflowKey }
    let shift = try XCTUnwrap(keys.first { $0.action == .shift })
    shift.accessibilityActivate()
    shift.accessibilityActivate()
    XCTAssertEqual(shift.accessibilityValue, "Caps Lock")
    let icon = try XCTUnwrap(Mirror(reflecting: shift).children.first { $0.label == "icon" }?.value as? UIImageView)
    let expected = UIImage(systemName: "capslock.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .regular))
    XCTAssertEqual(icon.image?.pngData(), expected?.pngData(), "Locked Shift must include Apple's underline")
    var output: [KeyflowAction] = []
    keyboard.onAction = { output.append($0) }
    let letter = try XCTUnwrap(keys.first { $0.action == .text("a") })
    letter.accessibilityActivate()
    letter.accessibilityActivate()
    XCTAssertEqual(output, [.text("A"), .text("A")])
    XCTAssertEqual(shift.accessibilityValue, "Caps Lock")
  }

  func testTabletShiftedCommaDisplaysAndInsertsExclamation() throws { try assertShiftedPunctuation(",", "!") }
  func testTabletShiftedPeriodDisplaysAndInsertsQuestion() throws { try assertShiftedPunctuation(".", "?") }

  func testTabletCapsLockClearsManualShift() throws {
    try withTabletModifiers { keyboard, keys in
      keys.first { $0.action == .shift }!.accessibilityActivate()
      keys.first { $0.action == .capsLock }!.accessibilityActivate()
      XCTAssertTrue(keys.first { $0.action == .capsLock }!.isLatched)
      XCTAssertFalse(keys.filter { $0.action == .shift }.contains(where: \.isLatched))
      XCTAssertEqual(keys.first { $0.action == .text(",") }!.caption, ",")
      keys.first { $0.action == .text("a") }!.accessibilityActivate()
      XCTAssertTrue(keys.first { $0.action == .capsLock }!.isLatched)
      XCTAssertEqual(keys.first { $0.action == .text("a") }!.caption, "A")
    }
  }

  func testTabletShiftTurnsCapsLockOff() throws {
    try withTabletModifiers { keyboard, keys in
      keys.first { $0.action == .capsLock }!.accessibilityActivate()
      keys.first { $0.action == .shift }!.accessibilityActivate()
      XCTAssertFalse(keys.first { $0.action == .capsLock }!.isLatched)
      XCTAssertFalse(keys.filter { $0.action == .shift }.contains(where: \.isLatched))
      XCTAssertEqual(keys.first { $0.action == .text("a") }!.caption, "a")
      XCTAssertEqual(keys.first { $0.action == .text(",") }!.caption, ",")
    }
  }

  private func assertShiftedPunctuation(_ base: String, _ shifted: String) throws {
    try withTabletModifiers { keyboard, keys in
      let punctuation = keys.first { $0.action == .text(base) }!
      keyboard.updateContext("")
      XCTAssertEqual(punctuation.caption, base, "Automatic case must not shift punctuation")
      keyboard.updateContext("word")
      keys.first { $0.action == .shift }!.accessibilityActivate()
      XCTAssertEqual(punctuation.caption, shifted)
      XCTAssertEqual(punctuation.accessibilityLabel, shifted)
      XCTAssertNil(punctuation.tabletAlternate)
      XCTAssertTrue(keys.filter { $0.action == .shift }.allSatisfy(\.isLatched))
      var output: KeyflowAction?
      keyboard.onAction = { output = $0 }
      keyboard.layoutIfNeeded()
      XCTAssertTrue(punctuation.labelFits)
      let image = UIGraphicsImageRenderer(bounds: keyboard.bounds).image { keyboard.layer.render(in: $0.cgContext) }
      let attachment = XCTAttachment(image: image)
      attachment.name = "ipad-shifted-" + (base == "," ? "comma" : "period")
      attachment.lifetime = .keepAlways
      add(attachment)
      punctuation.accessibilityActivate()
      XCTAssertEqual(output, .text(shifted))
      XCTAssertEqual(punctuation.caption, base)
      XCTAssertEqual(punctuation.tabletAlternate, shifted)
      XCTAssertFalse(keys.filter { $0.action == .shift }.contains(where: \.isLatched))
    }
  }

  private func withTabletModifiers(_ check: (KeyflowKeyboardView, [KeyflowKey]) -> Void) throws {
    try XCTSkipUnless(UIDevice.current.userInterfaceIdiom == .pad, "iPad modifier keys")
    let keyboard = KeyflowKeyboardView()
    keyboard.updateViewport(UIScreen.main.bounds.size, insets: .zero)
    keyboard.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: keyboard.intrinsicContentSize.height)
    keyboard.layoutIfNeeded()
    keyboard.updateContext("word")
    check(keyboard, keyboard.subviews.compactMap { $0 as? KeyflowKey })
  }

  func testHeldDeleteStopsOnRelease() throws { try assertHeldDeleteStops("release") }
  func testHeldDeleteStopsOnCancellation() throws { try assertHeldDeleteStops("cancel") }
  func testHeldDeleteStopsOutsideKey() throws { try assertHeldDeleteStops("outside") }

  private func assertHeldDeleteStops(_ ending: String) throws {
    let keyboard = KeyflowKeyboardView()
    let screen = UIScreen.main.bounds.size
    keyboard.updateViewport(screen, insets: .zero)
    keyboard.frame = CGRect(x: 0, y: 0, width: screen.width, height: keyboard.intrinsicContentSize.height)
    keyboard.layoutIfNeeded()
    let source = try XCTUnwrap(keyboard.subviews.compactMap { $0 as? KeyflowKey }.first { $0.action == .delete })
    let touch = AccentTouch()
    touch.point = CGPoint(x: source.frame.midX, y: source.frame.midY)
    var deletions = 0
    let repeats = expectation(description: "Held delete repeats")
    keyboard.onAction = { action in
      guard action == .delete else { return }
      deletions += 1
      if deletions == 3 { repeats.fulfill() }
    }
    keyboard.touchesBegan([touch], with: nil)
    defer { keyboard.touchesCancelled([touch], with: nil) }
    XCTAssertEqual(deletions, 1, "Delete immediately on touch-down")
    wait(for: [repeats], timeout: 2)
    switch ending {
    case "release": keyboard.touchesEnded([touch], with: nil)
    case "cancel": keyboard.touchesCancelled([touch], with: nil)
    default:
      touch.point = CGPoint(x: -20, y: -20)
      keyboard.touchesMoved([touch], with: nil)
    }
    let stopped = expectation(description: "Delete must remain stopped after \(ending)")
    stopped.isInverted = true
    keyboard.onAction = { if $0 == .delete { stopped.fulfill() } }
    wait(for: [stopped], timeout: 0.2)
  }

  func testSpacePressChangesDefaultFillAndRestoresOnRelease() throws {
    try assertSpacePress(theme: KeyflowTheme(), cancel: false)
  }

  func testSpacePressRestoresCustomFillOnCancellation() throws {
    var theme = KeyflowTheme()
    theme.keyBackground = "#17324F"
    theme.pressedKeyBackground = "#A13FC5"
    try assertSpacePress(theme: theme, cancel: true)
  }

  private func assertSpacePress(theme: KeyflowTheme, cancel: Bool) throws {
    let keyboard = KeyflowKeyboardView()
    keyboard.theme = theme
    let screen = UIScreen.main.bounds.size
    keyboard.updateViewport(screen, insets: .zero)
    keyboard.frame = CGRect(x: 0, y: 0, width: screen.width, height: keyboard.intrinsicContentSize.height)
    keyboard.layoutIfNeeded()
    let space = try XCTUnwrap(keyboard.subviews.compactMap { $0 as? KeyflowKey }.first { $0.action == .text(" ") })
    let resting = space.face.backgroundColor
    var actions: [KeyflowAction] = []
    keyboard.onAction = { actions.append($0) }
    let touch = AccentTouch()
    touch.point = CGPoint(x: space.frame.midX, y: space.frame.midY)
    keyboard.touchesBegan([touch], with: nil)
    XCTAssertNotEqual(space.face.backgroundColor, resting, "Space must visibly change fill on touch-down")
    XCTAssertEqual(space.face.backgroundColor, UIColor(keyflowHex: theme.pressedKeyBackground))
    if cancel { keyboard.touchesCancelled([touch], with: nil) }
    else { keyboard.touchesEnded([touch], with: nil) }
    XCTAssertEqual(space.face.backgroundColor, resting)
    XCTAssertEqual(actions, cancel ? [] : [.text(" ")])
  }

  func testSpaceTrackpadSoftensFacesAndRestoresCustomColors() throws {
    try withTrackpad { keyboard, touch, _ in
      let space = try XCTUnwrap(keyboard.subviews.compactMap { $0 as? KeyflowKey }.first { $0.action == .text(" ") })
      XCTAssertEqual(space.face.alpha, 0.5)
      XCTAssertNotNil(space.face.layer.animation(forKey: "opacity"), "Trackpad faces must fade with the legends")
      var theme = keyboard.theme
      theme.keyBackground = "#17324F"
      theme.pressedKeyBackground = "#A13FC5"
      space.theme = theme
      XCTAssertEqual(space.face.backgroundColor, UIColor(keyflowHex: theme.keyBackground))
      XCTAssertEqual(space.face.alpha, 0.5, "Trackpad must preserve custom fills while softening them")
      touch.point.x -= 24
      keyboard.touchesMoved([touch], with: nil)
      XCTAssertEqual(space.face.alpha, 0.5)
      keyboard.touchesEnded([touch], with: nil)
      XCTAssertEqual(space.face.alpha, 1)
      XCTAssertEqual(space.face.backgroundColor, UIColor(keyflowHex: theme.keyBackground))
    }
  }

  func testSpaceTrackpadLegendsFadeOnEntry() throws {
    try withTrackpad { keyboard, touch, legends in
      for legend in legends {
        XCTAssertEqual(legend.alpha, 0)
        let animation = try XCTUnwrap(legend.layer.animation(forKey: "opacity"), "Trackpad entry must fade instead of hiding instantly")
        XCTAssertGreaterThan(animation.duration, 0)
        XCTAssertLessThanOrEqual(animation.duration, 0.3)
      }
      var moves: [KeyflowAction] = []
      keyboard.onAction = { moves.append($0) }
      touch.point.x += 24
      keyboard.touchesMoved([touch], with: nil)
      XCTAssertEqual(moves, [.moveCursor(3)], "Fading must not block cursor movement")
    }
  }

  func testSpaceTrackpadReleaseRestoresLegendsDuringFade() throws {
    try withTrackpad { keyboard, touch, legends in
      keyboard.touchesEnded([touch], with: nil)
      for legend in legends { XCTAssertEqual(legend.alpha, 1) }
      RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.3))
      for legend in legends { XCTAssertEqual(legend.layer.presentation()?.opacity ?? legend.layer.opacity, 1, accuracy: 0.01) }
    }
  }

  func testSpaceTrackpadCancellationRestoresLegends() throws {
    try withTrackpad { keyboard, touch, legends in
      keyboard.touchesCancelled([touch], with: nil)
      RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.3))
      for legend in legends { XCTAssertEqual(legend.layer.presentation()?.opacity ?? legend.layer.opacity, 1, accuracy: 0.01) }
      XCTAssertFalse(keyboard.subviews.compactMap { $0 as? KeyflowKey }.contains { $0.hidesLegend || $0.face.alpha != 1 })
    }
  }

  private func withTrackpad(_ check: (KeyflowKeyboardView, AccentTouch, [UIView]) throws -> Void) throws {
    try XCTSkipIf(UIAccessibility.isReduceMotionEnabled, "Fade timing requires standard motion settings")
    let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
    let window = scene.map { UIWindow(windowScene: $0) } ?? UIWindow(frame: UIScreen.main.bounds)
    let controller = UIViewController()
    window.rootViewController = controller
    window.makeKeyAndVisible()
    defer { window.isHidden = true }
    let keyboard = KeyflowKeyboardView()
    keyboard.updateViewport(window.bounds.size, insets: .zero)
    keyboard.frame = CGRect(x: 0, y: 100, width: window.bounds.width, height: keyboard.intrinsicContentSize.height)
    controller.view.addSubview(keyboard)
    NSLayoutConstraint.activate([
      keyboard.leadingAnchor.constraint(equalTo: controller.view.leadingAnchor),
      keyboard.trailingAnchor.constraint(equalTo: controller.view.trailingAnchor),
      keyboard.topAnchor.constraint(equalTo: controller.view.topAnchor, constant: 100),
    ])
    window.layoutIfNeeded()
    keyboard.layoutIfNeeded()
    CATransaction.flush()
    RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.03))
    let keys = keyboard.subviews.compactMap { $0 as? KeyflowKey }
    let letter = try XCTUnwrap(keys.first { $0.action == .text("a") })
    let shift = try XCTUnwrap(keys.first { $0.action == .shift })
    let space = try XCTUnwrap(keys.first { $0.action == .text(" ") })
    func view(_ key: KeyflowKey, _ property: String) throws -> UIView {
      try XCTUnwrap(Mirror(reflecting: key).children.first { $0.label == property }?.value as? UIView)
    }
    var legends = try [view(letter, "label"), view(shift, "icon")]
    if letter.tabletAlternate != nil { legends.append(try view(letter, "padSubtitle")) }
    CATransaction.flush()
    for legend in legends { XCTAssertEqual(legend.alpha, 1) }
    let touch = AccentTouch()
    touch.point = CGPoint(x: space.frame.midX, y: space.frame.midY)
    keyboard.touchesBegan([touch], with: nil)
    defer { keyboard.touchesCancelled([touch], with: nil) }
    XCTAssertTrue(space.isPressed, "Space touch must enter the pressed state")
    // Sample immediately after the real hold changes the legend model opacity.
    let deadline = Date(timeIntervalSinceNow: 1)
    while !letter.hidesLegend && Date() < deadline {
      RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.005))
    }
    XCTAssertTrue(letter.hidesLegend, "Space hold must activate trackpad mode")
    CATransaction.flush()
    try check(keyboard, touch, legends)
  }

  private final class AccentTouch: UITouch {
    var point = CGPoint.zero
    override func location(in view: UIView?) -> CGPoint { point }
  }

  func testTabletDollarHoldCommitsInitialChoiceWithoutDrag() throws {
    try XCTSkipIf(UIDevice.current.userInterfaceIdiom != .pad, "iPad currency popup")
    try withAccentPopup(value: "$") { keyboard, touch, choices, _ in
      XCTAssertEqual(choices.first { $0.isPressed }?.action, .text("¢"))
      var actions: [KeyflowAction] = []
      keyboard.onAction = { actions.append($0) }
      keyboard.touchesEnded([touch], with: nil)
      XCTAssertEqual(actions, [.text("¢")], "Stationary release must commit the initial highlighted currency")
    }
  }

  private func withAccentPopup(value: String = "e", _ check: (KeyflowKeyboardView, AccentTouch, [KeyflowKey], UIView) throws -> Void) throws {
    let keyboard = KeyflowKeyboardView()
    let screen = UIScreen.main.bounds.size
    keyboard.updateViewport(screen, insets: .zero)
    keyboard.frame = CGRect(x: 0, y: 0, width: screen.width, height: keyboard.intrinsicContentSize.height)
    keyboard.layoutIfNeeded()
    if value == "$" {
      let numbers = try XCTUnwrap(keyboard.subviews.compactMap { $0 as? KeyflowKey }.first { $0.action == .numbers })
      XCTAssertTrue(numbers.accessibilityActivate())
      keyboard.layoutIfNeeded()
    }
    let source = try XCTUnwrap(keyboard.subviews.compactMap { $0 as? KeyflowKey }.first { $0.action == .text(value) })
    let touch = AccentTouch()
    touch.point = CGPoint(x: source.frame.midX, y: source.frame.midY)
    keyboard.touchesBegan([touch], with: nil)
    defer { keyboard.touchesCancelled([touch], with: nil) }
    let ready = NSPredicate { _, _ in keyboard.subviews.contains { ($0 as? KeyflowKey)?.isSelectionChoice == true } }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: keyboard)], timeout: 2), .completed)
    let choices = keyboard.subviews.compactMap { $0 as? KeyflowKey }.filter(\.isSelectionChoice).sorted { $0.frame.minX < $1.frame.minX }
    XCTAssertGreaterThan(choices.count, 2)
    // Test-only reflection avoids exposing presentation internals in the API.
    let indicator = try XCTUnwrap(Mirror(reflecting: keyboard).children.first { $0.label == "accentSelectionIndicator" }?.value as? UIView)
    try check(keyboard, touch, choices, indicator)
  }

  private func assertFits(_ type: String, _ material: String, _ fontSize: CGFloat, _ radius: CGFloat) {
    let screen = UIScreen.main.bounds.size
    let insets = UIEdgeInsets(top: 0, left: 0, bottom: UIDevice.current.userInterfaceIdiom == .pad ? 20 : 34, right: 0)
    let keyboard = KeyflowKeyboardView()
    keyboard.setKeyboardType(type)
    var theme = KeyflowTheme()
    theme.fontSize = fontSize
    theme.keyCornerRadius = radius
    theme.material = material
    theme.keyDepth = material == "raised" ? 6 : 0
    keyboard.theme = theme
    keyboard.updateViewport(screen, insets: insets)
    keyboard.frame = CGRect(x: 0, y: 0, width: screen.width, height: keyboard.intrinsicContentSize.height)
    keyboard.setNeedsLayout(); keyboard.layoutIfNeeded()
    let metrics = keyboard.metrics()
    let violations = metrics["violations"] as? [String] ?? ["Missing diagnostics"]
    XCTAssertTrue(violations.isEmpty, "\(type)/\(material)/\(fontSize)/\(radius): \(violations)")
    XCTAssertGreaterThan(metrics["keyCount"] as? Int ?? 0, 10)
  }
}
