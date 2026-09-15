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
  func keyflowSetCorrection(_ autocorrection: UITextAutocorrectionType, spellChecking: UITextSpellCheckingType) {
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
}

/// Keeps the unsnapped drag target independent of the resolved caret position.
final class KeyflowCursorNavigator {
  private var origin: CGPoint?
  func reset() { origin = nil }

  func begin(_ input: UIView & UITextInput) {
    guard let selection = input.selectedTextRange else { reset(); return }
    let caret = input.caretRect(for: selection.start)
    origin = CGPoint(x: caret.midX, y: caret.midY)
  }

  func move(_ input: UIView & UITextInput, translation: CGPoint) {
    if origin == nil { begin(input) }
    guard let origin else { return }
    let target = CGPoint(x: origin.x + translation.x, y: origin.y + translation.y)
    guard let position = input.closestPosition(to: target) else { return }
    if let selection = input.selectedTextRange, selection.isEmpty,
      input.compare(position, to: selection.start) == .orderedSame { return }
    let before = input.caretRect(for: position)
    input.selectedTextRange = input.textRange(from: position, to: position)
    if let view = input as? UITextView { view.scrollRangeToVisible(view.selectedRange) }
    input.layoutIfNeeded()
    // UITextField can scroll its internal text as selection changes. Keep the
    // original drag anchor in the same text coordinates after that adjustment.
    let after = input.caretRect(for: position)
    self.origin = CGPoint(x: origin.x + after.midX - before.midX, y: origin.y + after.midY - before.midY)
  }
}
