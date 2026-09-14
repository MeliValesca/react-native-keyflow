import UIKit

/// iPadOS English accent rows, recorded from the system keyboard.
/// Phone ordering remains in KeyflowKeyboardView's existing catalogue.
enum KeyflowTabletAccents {
  static let rows: [String: [String]] = [
    "a": ["ą", "ăåãæā", "ǎâàáä"],
    "e": ["ėēẽę", "ěêèéë"],
    "i": ["ıīĩį", "ǐîìíï"],
    "o": ["õőøœō", "ǒôòóö"],
    "u": ["ųűūũů", "ǔûùúü"],
    "c": ["čçćċ"],
    "n": ["ņñńň"],
    "s": ["šșßşś"],
    "y": ["ÿýŷ"],
    "z": ["żźž"],
    "l": ["ľłļ"],
    "d": ["ďð"],
    "r": ["ř"],
    "t": ["þțť"],
    "g": ["ğġ"],
    "h": ["ħ"],
    "k": ["ķ"],
    "w": ["ŵ"],
    "$": ["₽", "₩£¢€¥"],
    "-": ["•–—"],
  ]
  static let initial: [String: String] = [
    "a": "à",
    "e": "è",
    "i": "ì",
    "o": "ò",
    "u": "ù",
    "c": "ç",
    "n": "ñ",
    "s": "ß",
    "y": "ý",
    "z": "ź",
    "l": "ł",
    "d": "ď",
    "r": "ř",
    "t": "ț",
    "g": "ğ",
    "h": "ħ",
    "k": "ķ",
    "w": "ŵ",
    "$": "¢",
    "-": "–",
  ]

  static func choices(for value: String, shifted: Bool) -> [[String]]? {
    if shifted && value == "s" { return ["ȘŠßŚŞ".map(String.init)] }
    return rows[value]?.map { row in
      row.map { character in
        let text = String(character)
        if !shifted || text == "ß" { return text }
        return text == "ı" ? "İ" : text.uppercased()
      }
    }
  }
}
