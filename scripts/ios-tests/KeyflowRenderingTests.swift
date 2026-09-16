import XCTest
import UIKit

final class KeyflowRenderingTests: XCTestCase {
  func testReturnActionLetsReactNativeChooseSubmitOrNewline() {
    let field = UITextField()
    field.text = "message"
    let fieldDelegate = ReturnFieldDelegate()
    field.delegate = fieldDelegate
    dispatchKeyflowSubmit(field)
    XCTAssertEqual(fieldDelegate.returnCount, 1)
    XCTAssertEqual(field.text, "message", "A submit-only field must not insert a newline")

    let textView = UITextView()
    textView.text = "first line"
    let newlineDelegate = ReturnTextViewDelegate(acceptsNewline: true)
    textView.delegate = newlineDelegate
    dispatchKeyflowSubmit(textView)
    XCTAssertEqual(newlineDelegate.returnCount, 1)
    XCTAssertEqual(textView.text, "first line\n")

    let submitView = UITextView()
    submitView.text = "send this"
    let submitDelegate = ReturnTextViewDelegate(acceptsNewline: false)
    submitView.delegate = submitDelegate
    dispatchKeyflowSubmit(submitView)
    XCTAssertEqual(submitDelegate.returnCount, 1)
    XCTAssertEqual(
      submitView.text,
      "send this",
      "A multiline submit must be able to reject newline"
    )
  }

  func testReturnKeySupportsCustomTextAndPortableIcons() throws {
    let keyboard = KeyflowKeyboardView()
    let submit = try XCTUnwrap(
      keyboard.subviews.compactMap { $0 as? KeyflowKey }.first { $0.action == .submit })
    var theme = keyboard.theme
    theme.returnKeyContent = KeyflowReturnKeyContent(text: "Send", icon: nil)
    keyboard.theme = theme
    XCTAssertEqual(submit.caption, "Send")
    XCTAssertNil(submit.displayedSymbol)

    theme.returnKeyContent = KeyflowReturnKeyContent(text: nil, icon: "arrow-right")
    keyboard.theme = theme
    XCTAssertEqual(submit.displayedSymbol, "arrow.right")
    XCTAssertEqual(submit.accessibilityLabel, "return")
  }

  func testTeardownResignsBeforeRestoringInputViews() {
    let field = TeardownField()
    let original = UIView()
    field.keyflowRestoreInputViews(original, accessory: nil, resigningFocus: true)
    XCTAssertEqual(field.events, ["resign", "restore"])
    XCTAssertFalse(field.isFirstResponder)
    XCTAssertTrue(field.inputView === original)
  }

  func testAccentPopupOmitsBordersAndUsesKeyRadius() throws {
    let style = KeyflowSectionStyle(
      background: "#FFFF00", color: "#FFFFFF", placeholderColor: "#FFFFFF",
      iconColor: "#FFFFFF", pressedBackground: "#FFFF00", pressedColor: "#FFFFFF",
      borderColor: "#CC80FF", borderWidth: 4, cornerRadius: 3,
      fontFamily: nil, fontSize: 22, fontWeight: "regular", iconSize: 22)
    try withAccentPopup(selectionStyle: style) { keyboard, touch, choices, indicator in
      let popup = try XCTUnwrap(keyboard.subviews.compactMap { $0 as? KeyflowCallout }.first { !$0.isHidden })
      let outline = try XCTUnwrap(popup.layer.sublayers?.compactMap { $0 as? CAShapeLayer }.first)
      XCTAssertEqual(outline.lineWidth, 0)
      for choice in choices.prefix(3) {
        touch.point = choice.center
        keyboard.touchesMoved([touch], with: nil)
        XCTAssertEqual(indicator.center, choice.center)
        XCTAssertTrue(choice.frame.contains(indicator.frame))
        XCTAssertEqual(indicator.bounds.height, UIDevice.current.userInterfaceIdiom == .pad ? 52 : choice.bounds.height)
        XCTAssertEqual(choice.face.layer.borderWidth, 0)
        XCTAssertEqual(indicator.layer.cornerRadius, min(indicator.bounds.width, indicator.bounds.height) / 2)
      }
      let attachment = XCTAttachment(image: UIGraphicsImageRenderer(bounds: keyboard.bounds.insetBy(dx: 0, dy: -160)).image { context in
        context.cgContext.translateBy(x: 0, y: 160)
        keyboard.layer.render(in: context.cgContext)
      })
      attachment.name = "borderless-accent-fill"
      attachment.lifetime = .keepAlways
      add(attachment)
    }
  }

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

  func testPanelMaskLayoutDoesNotStartImplicitAnimations() throws {
    let keyboard = KeyflowKeyboardView()
    let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
    let window = scene.map { UIWindow(windowScene: $0) } ?? UIWindow(frame: UIScreen.main.bounds)
    let controller = UIViewController()
    window.rootViewController = controller
    window.makeKeyAndVisible()
    defer { window.isHidden = true }
    controller.view.addSubview(keyboard)
    keyboard.frame = CGRect(x: 0, y: 100, width: 390, height: keyboard.intrinsicContentSize.height)
    keyboard.layoutIfNeeded()
    let mask = try XCTUnwrap(keyboard.subviews.compactMap { $0.layer.mask }.first)
    CATransaction.flush()
    // UIKit lays the accessory out during an animated keyboard presentation.
    // Static clipping geometry must not add another animation on every layout.
    CATransaction.begin()
    CATransaction.setAnimationDuration(10)
    keyboard.frame.size.width += 1
    keyboard.setNeedsLayout()
    keyboard.layoutIfNeeded()
    CATransaction.commit()
    CATransaction.flush()
    XCTAssertEqual(mask.animationKeys() ?? [], [], "Static mask animations can keep XCTest waiting for the app to idle")
  }

  func testPanelCoversBottomCornersWithoutExtraOpacity() throws {
    for color in ["#163B50", "#163B5080"] {
      let keyboard = KeyflowKeyboardView()
      var theme = KeyflowTheme()
      theme.background = color
      keyboard.theme = theme
      keyboard.updateViewport(CGSize(width: 390, height: 844), insets: UIEdgeInsets(top: 0, left: 0, bottom: 34, right: 0))
      keyboard.frame = CGRect(x: 0, y: 0, width: 390, height: keyboard.intrinsicContentSize.height)
      keyboard.layoutIfNeeded()
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.preferredRange = .standard
      let image = UIGraphicsImageRenderer(bounds: keyboard.bounds, format: format).image { context in
        keyboard.layer.render(in: context.cgContext)
      }
      let cgImage = try XCTUnwrap(image.cgImage)
      let bytes = try XCTUnwrap(cgImage.dataProvider?.data) as Data
      let y = cgImage.height - 2
      func pixel(_ x: Int) -> [UInt8] {
        let offset = y * cgImage.bytesPerRow + x * cgImage.bitsPerPixel / 8
        return Array(bytes[offset..<(offset + cgImage.bitsPerPixel / 8)])
      }
      let middle = pixel(cgImage.width / 2)
      XCTAssertNotEqual(middle, Array(repeating: 0, count: middle.count))
      XCTAssertEqual(pixel(1), middle, "Left bottom corner must have the same panel fill and opacity")
      XCTAssertEqual(pixel(cgImage.width - 2), middle, "Right bottom corner must have the same panel fill and opacity")
      let attachment = XCTAttachment(image: image)
      attachment.name = "bottom-panel-\(color)"
      attachment.lifetime = .keepAlways
      add(attachment)
    }
  }

  func testTrackpadCaretFloatsBetweenCharactersAndRestoresOnRelease() throws {
    let view = UITextView(frame: CGRect(x: 0, y: 0, width: 240, height: 180))
    view.font = UIFont.monospacedSystemFont(ofSize: 20, weight: .regular)
    view.text = "abcdef\nsecond line"
    view.tintColor = .systemBlue
    view.selectedRange = NSRange(location: 2, length: 0)
    view.layoutIfNeeded()
    let initial = view.caretRect(for: try XCTUnwrap(view.selectedTextRange).start)
    let navigator = KeyflowCursorNavigator()
    navigator.begin(view)
    navigator.move(view, translation: CGPoint(x: 0.25, y: 3.5))
    XCTAssertEqual(view.selectedRange.location, 2)
    XCTAssertEqual(navigator.floatingCaret.frame.midX, initial.midX + 0.25, accuracy: 0.01)
    XCTAssertEqual(navigator.floatingCaret.frame.midY, initial.midY + 3.5, accuracy: 0.01)
    XCTAssertEqual(view.tintColor, .clear)
    navigator.move(view, translation: CGPoint(x: 180, y: 90))
    XCTAssertGreaterThan(navigator.floatingCaret.frame.midX, view.caretRect(for: try XCTUnwrap(view.selectedTextRange).start).midX)
    let image = UIGraphicsImageRenderer(bounds: view.bounds).image { view.layer.render(in: $0.cgContext) }
    let attachment = XCTAttachment(image: image)
    attachment.name = "floating-caret-in-blank-space"
    attachment.lifetime = .keepAlways
    add(attachment)
    navigator.reset()
    XCTAssertNil(navigator.floatingCaret.superview)
    XCTAssertEqual(view.tintColor, .systemBlue)
    XCTAssertEqual(view.selectedRange.location, view.text.count)
  }

  func testTrackpadSnapsToTheVisuallyNearestCaretInsteadOfTheTrailingHit() throws {
    final class TrailingBiasedTextView: UITextView {
      override func closestPosition(to point: CGPoint) -> UITextPosition? {
        super.closestPosition(to: CGPoint(x: point.x + 24, y: point.y))
      }
    }
    let view = TrailingBiasedTextView(frame: CGRect(x: 0, y: 0, width: 240, height: 100))
    view.font = UIFont.monospacedSystemFont(ofSize: 20, weight: .regular)
    view.text = "abcdef"
    view.selectedRange = NSRange(location: 2, length: 0)
    view.layoutIfNeeded()
    let start = view.caretRect(for: try XCTUnwrap(view.selectedTextRange).start)
    let nextPosition = try XCTUnwrap(view.position(from: view.beginningOfDocument, offset: 3))
    let next = view.caretRect(for: nextPosition)
    let targetX = start.midX + (next.midX - start.midX) * 0.4
    let cursor = KeyflowCursorNavigator()
    cursor.begin(view)
    cursor.move(view, translation: CGPoint(x: targetX - start.midX, y: 0))
    XCTAssertEqual(
      view.selectedRange.location, 2,
      "A trailing-biased UIKit hit must not move past the visually nearest caret")
    XCTAssertEqual(cursor.floatingCaret.frame.midX, targetX, accuracy: 0.01)
  }

  func testTrackpadReleaseCommitsTheVisibleCaretBoundary() throws {
    let field = UITextField(frame: CGRect(x: 0, y: 0, width: 280, height: 48))
    field.font = UIFont.systemFont(ofSize: 20)
    field.text = "beta alpha"
    field.layoutIfNeeded()
    let end = field.endOfDocument
    field.selectedTextRange = field.textRange(from: end, to: end)
    let cursor = KeyflowCursorNavigator()
    cursor.begin(field)
    cursor.move(field, translation: CGPoint(x: -20, y: 0))

    let afterA = try XCTUnwrap(field.position(from: field.beginningOfDocument, offset: 6))
    cursor.floatingCaret.center = CGPoint(
      x: field.caretRect(for: afterA).midX,
      y: cursor.floatingCaret.center.y
    )
    cursor.end(field)

    XCTAssertEqual(
      field.offset(from: field.beginningOfDocument, to: try XCTUnwrap(field.selectedTextRange).start),
      6,
      "Release must keep the caret at beta a|lpha when that is the visible boundary"
    )
  }

  func testTrackpadReleaseBiasesAmbiguousMidpointInDragDirection() throws {
    let field = UITextField(frame: CGRect(x: 0, y: 0, width: 280, height: 48))
    field.font = UIFont.systemFont(ofSize: 20)
    field.text = "beta alpha"
    field.layoutIfNeeded()
    let leading = try XCTUnwrap(field.position(from: field.beginningOfDocument, offset: 2))
    let trailing = try XCTUnwrap(field.position(from: field.beginningOfDocument, offset: 3))
    let midpoint = (field.caretRect(for: leading).midX + field.caretRect(for: trailing).midX) / 2

    let backward = KeyflowCursorNavigator()
    field.selectedTextRange = field.textRange(from: field.endOfDocument, to: field.endOfDocument)
    backward.begin(field)
    backward.move(field, translation: CGPoint(x: -20, y: 0))
    backward.floatingCaret.center.x = midpoint + 0.5
    backward.end(field)
    XCTAssertEqual(
      field.offset(from: field.beginningOfDocument, to: try XCTUnwrap(field.selectedTextRange).start),
      2,
      "A backward release just past the midpoint must not snap one boundary to the right"
    )

    let forward = KeyflowCursorNavigator()
    field.selectedTextRange = field.textRange(
      from: field.beginningOfDocument, to: field.beginningOfDocument)
    forward.begin(field)
    forward.move(field, translation: CGPoint(x: 20, y: 0))
    forward.floatingCaret.center.x = midpoint - 0.5
    forward.end(field)
    XCTAssertEqual(
      field.offset(from: field.beginningOfDocument, to: try XCTUnwrap(field.selectedTextRange).start),
      3,
      "A forward release just before the midpoint must not snap one boundary to the left"
    )
  }

  func testTrackpadSelectsTheExactVisibleBoundaryWhenDraggingBackward() throws {
    let field = UITextField(frame: CGRect(x: 0, y: 0, width: 280, height: 48))
    field.font = UIFont.systemFont(ofSize: 20)
    field.text = "beta alpha"
    let view = UITextView(frame: CGRect(x: 0, y: 0, width: 280, height: 100))
    view.font = UIFont.systemFont(ofSize: 20)
    view.text = "beta alpha"
    let editors: [UIView & UITextInput] = [
      field,
      view,
    ]
    for editor in editors {
      editor.layoutIfNeeded()
      let end = editor.endOfDocument
      editor.selectedTextRange = editor.textRange(from: end, to: end)
      let startCaret = editor.caretRect(for: end)
      let afterB = try XCTUnwrap(editor.position(from: editor.beginningOfDocument, offset: 1))
      let target = editor.caretRect(for: afterB)
      let navigator = KeyflowCursorNavigator()
      navigator.begin(editor)
      navigator.move(
        editor,
        translation: CGPoint(x: target.midX - startCaret.midX, y: target.midY - startCaret.midY)
      )
      let selected = try XCTUnwrap(editor.selectedTextRange)
      XCTAssertEqual(editor.offset(from: editor.beginningOfDocument, to: selected.start), 1)
      XCTAssertEqual(navigator.floatingCaret.frame.midX, target.midX, accuracy: 0.01)
    }
  }

  func testMultilineCursorMovesAcrossVisualLinesAndEmoji() throws {
    let view = UITextView(frame: CGRect(x: 0, y: 0, width: 150, height: 220))
    view.font = UIFont.monospacedSystemFont(ofSize: 18, weight: .regular)
    view.text = "abcdefghi\nx\nabcdefghi\nlong text that wraps onto more than one visual line 👨‍👩‍👧‍👦"
    view.layoutIfNeeded()
    view.selectedRange = NSRange(location: 5, length: 0)
    let cursor = KeyflowCursorNavigator()
    let initial = view.caretRect(for: try XCTUnwrap(view.selectedTextRange).start)
    cursor.begin(view)
    cursor.move(view, translation: CGPoint(x: 0, y: initial.height))
    XCTAssertEqual(view.selectedRange.location, 11, "Short lines must clamp to their end")
    cursor.move(view, translation: CGPoint(x: 0, y: initial.height * 2))
    XCTAssertEqual(view.selectedRange.location, 17, "The unsnapped horizontal target must survive a short line")
    cursor.move(view, translation: .zero)
    XCTAssertEqual(view.selectedRange.location, 5, "Reversing the drag must return to the original column")
    view.selectedRange = NSRange(location: (view.text as NSString).length, length: 0)
    cursor.begin(view)
    let string = view.text as NSString
    let emoji = string.rangeOfComposedCharacterSequence(at: string.length - 1)
    for dx: CGFloat in [-1, -5, -10, -20] {
      cursor.move(view, translation: CGPoint(x: dx, y: 0))
      let offset = view.selectedRange.location
      XCTAssertTrue(offset <= emoji.location || offset == string.length, "Native hit testing must not split composed emoji")
    }
    let caret = view.caretRect(for: view.endOfDocument)
    cursor.move(view, translation: CGPoint(x: 0, y: -caret.height))
    let moved = view.caretRect(for: try XCTUnwrap(view.selectedTextRange).start)
    XCTAssertLessThan(moved.midY, caret.midY, "Wrapped text must use rendered line geometry")
  }

  func testTrackpadEmitsBothCursorAxes() throws {
    try withTrackpad { keyboard, touch, _ in
      var moves: [KeyflowAction] = []
      keyboard.onAction = { moves.append($0) }
      touch.point.x += 0.25
      touch.point.y += 0.5
      keyboard.touchesMoved([touch], with: nil)
      XCTAssertEqual(moves, [.moveCursor(CGPoint(x: 0.25, y: 0.5))], "Even fractional drag coordinates must reach native hit testing")
      touch.point.x += 16
      touch.point.y += 48
      keyboard.touchesMoved([touch], with: nil)
      XCTAssertEqual(moves.last, .moveCursor(CGPoint(x: 16.25, y: 48.5)))
    }
  }

  func testTrackpadReleaseKeepsTheLastVisibleCaretPosition() throws {
    try withTrackpad { keyboard, touch, _ in
      var actions: [KeyflowAction] = []
      keyboard.onAction = { actions.append($0) }
      touch.point.x += 24
      keyboard.touchesMoved([touch], with: nil)

      // A finger commonly shifts as it lifts. Releasing must commit the last
      // visible caret instead of performing a hidden move at this new point.
      touch.point.x += 12
      keyboard.touchesEnded([touch], with: nil)

      XCTAssertEqual(
        actions,
        [.moveCursor(CGPoint(x: 24, y: 0)), .endCursorMovement]
      )
    }
  }

  func testAccentPresentationRespectsHapticsSetting() throws {
    for enabled in [false, true] {
      var pulses = 0
      try withAccentPopup(hapticsEnabled: enabled, feedback: { pulses += 1 }) { keyboard, touch, choices, _ in
        XCTAssertEqual(pulses, enabled ? 1 : 0, "Opening accents must emit exactly one enabled haptic")
        touch.point = try XCTUnwrap(choices.first { !$0.isPressed }).center
        keyboard.touchesMoved([touch], with: nil)
        XCTAssertEqual(pulses, enabled ? 2 : 0, "Selecting a different accent must pulse")
        keyboard.touchesMoved([touch], with: nil)
        XCTAssertEqual(pulses, enabled ? 2 : 0, "Moving within the same accent must not pulse again")
      }
      XCTAssertEqual(pulses, enabled ? 2 : 0, "Cancellation must not emit a haptic")
    }
  }

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
      XCTAssertEqual(moves, [.moveCursor(CGPoint(x: 24, y: 0))], "Fading must not block cursor movement")
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

  private func withAccentPopup(value: String = "e", hapticsEnabled: Bool = false, feedback: (() -> Void)? = nil, selectionStyle: KeyflowSectionStyle? = nil, _ check: (KeyflowKeyboardView, AccentTouch, [KeyflowKey], UIView) throws -> Void) throws {
    let keyboard = KeyflowKeyboardView()
    if let selectionStyle {
      var theme = keyboard.theme
      var keys = selectionStyle
      keys.cornerRadius = 100
      keys.background = "#163B50"
      theme.sections = ["selection": selectionStyle, "keys": keys, "preview": keys]
      keyboard.theme = theme
    }
    keyboard.hapticsEnabled = hapticsEnabled
    if let feedback { keyboard.hapticFeedback = feedback }
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

private final class ReturnFieldDelegate: NSObject, UITextFieldDelegate {
  var returnCount = 0

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    returnCount += 1
    return false
  }
}

private final class ReturnTextViewDelegate: NSObject, UITextViewDelegate {
  let acceptsNewline: Bool
  var returnCount = 0

  init(acceptsNewline: Bool) { self.acceptsNewline = acceptsNewline }

  func textView(
    _ textView: UITextView,
    shouldChangeTextIn range: NSRange,
    replacementText text: String
  ) -> Bool {
    if text == "\n" { returnCount += 1 }
    return acceptsNewline
  }
}

private final class TeardownField: UITextField {
  var events: [String] = []
  private var simulatedFocus = true
  override var isFirstResponder: Bool { simulatedFocus }
  override func resignFirstResponder() -> Bool {
    events.append("resign")
    simulatedFocus = false
    return true
  }
  override var inputView: UIView? {
    didSet { events.append("restore") }
  }
  override func reloadInputViews() { events.append("reload") }
}
