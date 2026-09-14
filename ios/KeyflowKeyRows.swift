import UIKit

enum KeyflowKeyboardPage { case letters, numbers, symbols }

/// Creates the platform key rows; the keyboard supplies activation wiring.
struct KeyflowKeyRows {
  let isPad: Bool
  let isTablet: Bool
  let landscape: Bool
  let keyboardType: String
  let language: KeyflowLanguage
  let canSwitchLanguage: Bool
  let rowHeight: CGFloat
  let page: KeyflowKeyboardPage
  let makeKey: (String, KeyflowAction, String?) -> KeyflowKey

  private func key(_ caption: String, _ action: KeyflowAction, symbol: String? = nil) -> KeyflowKey
  {
    makeKey(caption, action, symbol)
  }
  private func letters(_ value: String) -> [KeyflowKey] {
    value.map { key(String($0), .text(String($0))) }
  }

  private func tabletLetters(_ value: String, alternates: String) -> [KeyflowKey] {
    zip(value, alternates).map { character, alternate in
      let item = key(String(character), .text(String(character)))
      item.tabletAlternate = String(alternate)
      return item
    }
  }

  func makeRows() -> [[KeyflowKey]] {
    var rows: [[KeyflowKey]] = []
    if isPad {
      let decimal = Locale.current.decimalSeparator ?? "."
      let phoneSymbols = keyboardType == "phone-pad" && page == .symbols
      rows = [letters("123"), letters("456"), letters("789")]
      if phoneSymbols {
        rows[1][0].removeFromSuperview()
        rows[1][2].removeFromSuperview()
        rows[2][0].removeFromSuperview()
        rows[2][2].removeFromSuperview()
        rows[1][0] = key("pause", .text(","))
        rows[1][2] = key("wait", .text(";"))
        rows[2][0] = key("*", .text("*"))
        rows[2][2] = key("#", .text("#"))
        for item in [rows[0][0], rows[0][1], rows[0][2], rows[1][1], rows[2][1]] {
          item.isDisabledKey = true
          item.isAccessibilityElement = false
        }
      }
      let first: KeyflowKey
      if keyboardType == "decimal-pad" {
        first = key(decimal, .text(decimal))
      } else if keyboardType == "phone-pad" {
        first = key(phoneSymbols ? "123" : "+*#", phoneSymbols ? .letters : .symbols)
      } else {
        first = key("", .text(""))
        first.isAccessibilityElement = false
        first.face.isHidden = true
      }
      rows.append([
        first, key(phoneSymbols ? "+" : "0", .text(phoneSymbols ? "+" : "0")),
        key("Delete", .delete, symbol: "delete.left"),
      ])
      first.padUnfilled = !(phoneSymbols && landscape)
      rows[3][2].padUnfilled = true
      if phoneSymbols { rows[3][1].padUnfilled = landscape }
      let subtitles = [
        "2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL", "6": "MNO", "7": "PQRS", "8": "TUV",
        "9": "WXYZ",
      ]
      for item in rows.flatMap({ $0 }) {
        item.allowsPreview = false
        item.padLegend = subtitles[item.caption]
        item.isPadKey = true
      }
    } else if isTablet {
      switch page {
      case .letters:
        rows = [
          [key("Tab", .text("\t"), symbol: "arrow.right.to.line")]
            + tabletLetters(language.letterRows[0], alternates: "1234567890") + [
              key("Delete", .delete, symbol: "delete.left")
            ],
          [key("Caps Lock", .capsLock, symbol: "capslock")]
            + tabletLetters(language.letterRows[1], alternates: "@#$&*()'\"") + [
              key(language.base == "fr" ? "retour" : "return", .submit, symbol: "return")
            ],
          [key("Shift", .shift, symbol: "shift")]
            + tabletLetters(language.letterRows[2], alternates: "%-+=/;:") + [
              key(",", .text(",")), key(".", .text(".")), key("Shift", .shift, symbol: "shift"),
            ],
        ]
      case .numbers:
        let returnKey = {
          self.key(self.language.base == "fr" ? "retour" : "return", .submit, symbol: "return")
        }
        rows = [
          [key("Tab", .text("\t"), symbol: "arrow.right.to.line")] + letters("1234567890") + [
            key("Delete", .delete, symbol: "delete.left")
          ],
          [returnKey()] + tabletLetters("@#$&*()'\"", alternates: "€£¥–^[]{}") + [returnKey()],
          [key("#+=", .symbols)]
            + (landscape
              ? tabletLetters("%-+=/;:", alternates: "§|~…\\<>") + [
                key(",", .text(",")), key(".", .text(".")),
              ]
              : tabletLetters("%-+=/;:!?", alternates: "§|~…\\<>,.")) + [key("#+=", .symbols)],
        ]
      case .symbols:
        let returnKey = {
          self.key(self.language.base == "fr" ? "retour" : "return", .submit, symbol: "return")
        }
        rows = [
          [key("Tab", .text("\t"), symbol: "arrow.right.to.line")] + letters("1234567890") + [
            key("Delete", .delete, symbol: "delete.left")
          ],
          [returnKey()] + letters("€£¥–^[]{}") + [returnKey()],
          [key("123", .numbers)] + letters(landscape ? "§|~…\\<>,." : "§|~…\\<>,.") + [
            key("123", .numbers)
          ],
        ]
      }
      let pageToggle = page == .letters ? "123" : "ABC"
      let pageAction: KeyflowAction = page == .letters ? .numbers : .letters
      if canSwitchLanguage {
        let languageKey = key("Next language", .nextLanguage, symbol: "globe")
        languageKey.accessibilityValue = language.name
        rows.append([
          languageKey, key(pageToggle, pageAction), key("space", .text(" ")),
          key(pageToggle, pageAction),
          key("Dismiss", .dismiss, symbol: "keyboard.chevron.compact.down"),
        ])
      } else {
        rows.append([
          key(pageToggle, pageAction), key("space", .text(" ")), key(pageToggle, pageAction),
          key("Dismiss", .dismiss, symbol: "keyboard.chevron.compact.down"),
        ])
      }
      for row in rows {
        row.first?.tabletEdgeAlignment = -1
        row.last?.tabletEdgeAlignment = 1
      }
      // Tab and Delete sit on the Q-row baseline in Apple's iPad keyboard.
      // The remaining action glyphs are optically centered in their rows.
      rows.first?.first?.tabletIconVerticalOffset = rowHeight * 0.185
      rows.first?.last?.tabletIconVerticalOffset = rowHeight * 0.185
    } else {
      switch page {
      case .letters:
        rows = [
          letters(language.letterRows[0]), letters(language.letterRows[1]),
          [key("Shift", .shift, symbol: "shift")] + letters(language.letterRows[2]) + [
            key("Delete", .delete, symbol: "delete.left")
          ],
        ]
      case .numbers:
        rows = [
          letters("1234567890"), letters("-/:;()\(language.currency)&@\""),
          [key("#+=", .symbols, symbol: "keyflow.symbols")] + letters(".,?!'") + [
            key("Delete", .delete, symbol: "delete.left")
          ],
        ]
      case .symbols:
        rows = [
          letters("[]{}#%^*+="), letters(language.currency == "€" ? "_\\|~<>$£¥•" : "_\\|~<>€£¥•"),
          [key("123", .numbers)] + letters(".,?!'") + [
            key("Delete", .delete, symbol: "delete.left")
          ],
        ]
      }
      rows.append([
        key(page == .letters ? "123" : "ABC", page == .letters ? .numbers : .letters),
        key("space", .text(" ")),
        key(language.base == "fr" ? "retour" : "return", .submit, symbol: "return"),
      ])
      if canSwitchLanguage {
        let switcher = key("Next language", .nextLanguage, symbol: "globe")
        switcher.accessibilityValue = language.name
        rows[3].insert(switcher, at: 1)
      }
    }
    return rows
  }
}
