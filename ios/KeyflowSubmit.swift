import UIKit

/// Sends Return through UIKit so React Native remains responsible for
/// `submitBehavior`, `onSubmitEditing`, newline insertion, and blur behavior.
func dispatchKeyflowSubmit(_ editor: UIView & UITextInput) {
  if let field = editor as? UITextField {
    if field.delegate?.textFieldShouldReturn?(field) ?? true { field.resignFirstResponder() }
  } else if let view = editor as? UITextView {
    let selected = view.selectedRange
    let acceptsReturn =
      view.delegate?.textView?(
        view,
        shouldChangeTextIn: selected,
        replacementText: "\n"
      ) ?? true
    if acceptsReturn { view.insertText("\n") }
  } else {
    editor.insertText("\n")
  }
}
