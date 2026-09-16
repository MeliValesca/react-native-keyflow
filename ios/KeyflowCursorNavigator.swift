import UIKit

extension UITextInput where Self: UIView {
  var keyflowText: String {
    guard let range = textRange(from: beginningOfDocument, to: endOfDocument) else { return "" }
    return text(in: range) ?? ""
  }
  var keyflowEditable: Bool {
    if let field = self as? UITextField { return field.isEnabled }
    return (self as? UITextView)?.isEditable == true
  }
  var keyflowAutocorrection: UITextAutocorrectionType {
    if let field = self as? UITextField { return field.autocorrectionType }
    return (self as? UITextView)?.autocorrectionType ?? .default
  }
  var keyflowSpellChecking: UITextSpellCheckingType {
    if let field = self as? UITextField { return field.spellCheckingType }
    return (self as? UITextView)?.spellCheckingType ?? .default
  }
  func keyflowSetCorrection(
    _ autocorrection: UITextAutocorrectionType, spellChecking: UITextSpellCheckingType
  ) {
    if let field = self as? UITextField {
      field.autocorrectionType = autocorrection
      field.spellCheckingType = spellChecking
    } else if let view = self as? UITextView {
      view.autocorrectionType = autocorrection
      view.spellCheckingType = spellChecking
    }
  }
  func keyflowSetInputViews(_ surface: UIView?, accessory: UIView?) {
    if let field = self as? UITextField {
      field.inputView = surface
      field.inputAccessoryView = accessory
    } else if let view = self as? UITextView {
      view.inputView = surface
      view.inputAccessoryView = accessory
    }
  }

  func keyflowRestoreInputViews(
    _ surface: UIView?, accessory: UIView?, resigningFocus: Bool
  ) {
    if resigningFocus { resignFirstResponder() }
    keyflowSetInputViews(surface, accessory: accessory)
  }
}

/// Keeps the unsnapped drag target independent of the resolved caret position.
final class KeyflowCursorNavigator {
  private var origin: CGPoint?
  private weak var editor: (UIView & UITextInput)?
  private var originalTint: UIColor?
  let floatingCaret = UIView()
  func reset() {
    if let editor, let originalTint { editor.tintColor = originalTint }
    floatingCaret.removeFromSuperview()
    editor = nil
    originalTint = nil
    origin = nil
  }

  func begin(_ input: UIView & UITextInput) {
    reset()
    guard let selection = input.selectedTextRange else { reset(); return }
    let caret = input.caretRect(for: selection.start)
    origin = CGPoint(x: caret.midX, y: caret.midY)
  }

  private func nearestCaretPosition(
    in input: UIView & UITextInput, to target: CGPoint
  ) -> UITextPosition? {
    guard let hit = input.closestPosition(to: target) else { return nil }
    func distance(to position: UITextPosition) -> CGFloat {
      let caret = input.caretRect(for: position)
      return hypot(caret.midX - target.x, caret.midY - target.y)
    }
    var best = hit
    let hitDistance = distance(to: hit)
    var bestDistance = hitDistance
    for direction in [-1, 1] {
      var current = hit
      var currentDistance = hitDistance
      while let candidate = input.position(from: current, offset: direction) {
        let candidateDistance = distance(to: candidate)
        guard candidateDistance <= currentDistance + 0.01 else { break }
        if candidateDistance < bestDistance - 0.01
          || (abs(candidateDistance - bestDistance) <= 0.01
            && input.compare(candidate, to: best) == .orderedAscending)
        {
          best = candidate
          bestDistance = candidateDistance
        }
        current = candidate
        currentDistance = candidateDistance
      }
    }
    return best
  }

  func move(_ input: UIView & UITextInput, translation: CGPoint) {
    if origin == nil { begin(input) }
    guard let origin else { return }
    let target = CGPoint(x: origin.x + translation.x, y: origin.y + translation.y)
    guard let position = nearestCaretPosition(in: input, to: target) else { return }
    let before = input.caretRect(for: position)
    if editor == nil {
      editor = input
      originalTint = input.tintColor
      floatingCaret.backgroundColor = input.tintColor
      floatingCaret.isUserInteractionEnabled = false
      floatingCaret.isAccessibilityElement = false
      input.addSubview(floatingCaret)
      input.tintColor = .clear
    }
    if let selection = input.selectedTextRange,
      !selection.isEmpty || input.compare(position, to: selection.start) != .orderedSame
    {
      input.selectedTextRange = input.textRange(from: position, to: position)
      if let view = input as? UITextView { view.scrollRangeToVisible(view.selectedRange) }
    }
    input.layoutIfNeeded()
    // UITextField can scroll its internal text as selection changes. Keep the
    // original drag anchor in the same text coordinates after that adjustment.
    let after = input.caretRect(for: position)
    self.origin = CGPoint(
      x: origin.x + after.midX - before.midX, y: origin.y + after.midY - before.midY)
    let width = max(2, before.width)
    let height = max(1, before.height)
    let x = min(
      max(target.x + after.midX - before.midX, input.bounds.minX + width / 2),
      input.bounds.maxX - width / 2)
    let y = min(
      max(target.y + after.midY - before.midY, input.bounds.minY + height / 2),
      input.bounds.maxY - height / 2)
    floatingCaret.frame = CGRect(x: x - width / 2, y: y - height / 2, width: width, height: height)
  }

  func end(_ input: UIView & UITextInput) {
    // Selection is resolved before UIKit lays out the newly selected caret.
    // UITextField may shift its internal text during that layout, while the
    // floating caret is adjusted into the final coordinate space. Resolve once
    // more from the visible caret so releasing cannot reveal an adjacent slot.
    if editor === input, floatingCaret.superview === input,
      let position = nearestCaretPosition(in: input, to: floatingCaret.center)
    {
      input.selectedTextRange = input.textRange(from: position, to: position)
      if let view = input as? UITextView { view.scrollRangeToVisible(view.selectedRange) }
    }
    reset()
  }
}
