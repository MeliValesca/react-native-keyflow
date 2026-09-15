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

/// Uses native caret geometry for visual lines, including soft-wrapped text.
final class KeyflowCursorNavigator {
  private var preferredX: CGFloat?
  func reset() { preferredX = nil }

  func move(_ input: UIView & UITextInput, horizontal: Int, vertical: Int) {
    guard let selection = input.selectedTextRange else { return }
    var position = selection.start
    if horizontal != 0 {
      reset()
      let text = input.keyflowText as NSString
      var offset = input.offset(from: input.beginningOfDocument, to: position)
      for _ in 0..<abs(horizontal) {
        if horizontal < 0 && offset > 0 {
          offset = text.rangeOfComposedCharacterSequence(at: offset - 1).location
        } else if horizontal > 0 && offset < text.length {
          offset = NSMaxRange(text.rangeOfComposedCharacterSequence(at: offset))
        }
      }
      position = input.position(from: input.beginningOfDocument, offset: offset) ?? position
    }
    if vertical != 0, input is UITextView {
      let caret = input.caretRect(for: position)
      if preferredX == nil { preferredX = caret.midX }
      let target = CGPoint(x: preferredX!, y: caret.midY + CGFloat(vertical) * max(1, caret.height))
      position = input.closestPosition(to: target) ?? position
    }
    input.selectedTextRange = input.textRange(from: position, to: position)
    if let view = input as? UITextView { view.scrollRangeToVisible(view.selectedRange) }
  }
}
