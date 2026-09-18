import UIKit

struct KeyflowTheme: Decodable, Equatable {
  var returnKeyContent: KeyflowReturnKeyContent?
  var sections: [String: KeyflowSectionStyle]?
  var sectionOverrides: [String: KeyflowSectionOverrides]?
  var strokeColor: String?
  var strokeWidth: Double?
  var background = "#E0E2E7"
  var keyBackground = "#FFFFFF"
  var keyForeground = "#000000"
  var pressedKeyBackground = "#C1C3C6"
  var selectedKeyBackground = "#008FFF"
  var selectedKeyForeground = "#FFFFFF"
  var specialKeyBackground = "#FFFFFF"
  var actionKeyBackground = "#FFFFFF"
  var actionKeyForeground = "#000000"
  var material = "flat"
  var fontWeight = "regular"
  var specialKeyForeground = "#000000"
  var deleteKeyBackground = "#FFFFFF"
  var keyShadow = "#000000"
  var keyHighlight = "#FFFFFF"
  var keyDepth: Double = 4
  var fontFamily: String? = nil
  var fontSize: Double = 22
  var keyCornerRadius: Double = 8
  var keyboardCornerRadius: Double = 28
  var keyboardBorderColor = "#00000000"
  var keyboardBorderWidth: Double = 0

  func font(
    size: CGFloat, weight: UIFont.Weight = .regular, keyboard: Bool = false,
    character: String? = nil
  ) -> UIFont {
    let resolvedWeight: UIFont.Weight =
      fontWeight == "bold" ? .bold : fontWeight == "medium" ? .medium : weight
    let system = UIFont.systemFont(ofSize: size, weight: resolvedWeight)
    if let name = fontFamily {
      let designs: [String: UIFontDescriptor.SystemDesign] = [
        "system-rounded": .rounded, "system-serif": .serif, "system-monospace": .monospaced,
      ]
      if let design = designs[name], let descriptor = system.fontDescriptor.withDesign(design) {
        return UIFont(descriptor: descriptor, size: size)
      }
      // fontNames resolves expo-font aliases as well as registered families.
      let names = UIFont.fontNames(forFamilyName: name)
      let selected =
        fontWeight == "bold" ? names.first(where: { $0.lowercased().contains("bold") }) : nil
      if let custom = UIFont(name: selected ?? names.first ?? name, size: size) { return custom }
    }
    // Optical width compensation for the round capitals in the iOS 26
    // reference. Keep the system font's stroke weight; custom fonts are intact.
    // Apple's internal Compact face is not exposed as a public UIFont face.
    if #available(iOS 26.0, *), keyboard, fontFamily == nil {
      let width: CGFloat = ["C", "G", "O", "Q"].contains(character ?? "") ? -0.07 : -0.015
      return UIFont.systemFont(
        ofSize: size, weight: resolvedWeight, width: UIFont.Width(rawValue: width))
    }
    return system
  }
}

struct KeyflowReturnKeyContent: Decodable, Equatable {
  var text: String?
  var icon: String?
}

extension UIColor {
  convenience init(keyflowHex: String) {
    let hex = String(keyflowHex.dropFirst())
    let value = UInt64(hex, radix: 16) ?? 0
    let alphaLast = hex.count == 8
    let rgb = alphaLast ? value >> 8 : value
    self.init(
      red: CGFloat((rgb >> 16) & 255) / 255,
      green: CGFloat((rgb >> 8) & 255) / 255,
      blue: CGFloat(rgb & 255) / 255,
      alpha: alphaLast ? CGFloat(value & 255) / 255 : 1
    )
  }
}

struct KeyflowSectionStyle: Decodable, Equatable {
  var background: String
  var color: String
  var placeholderColor: String
  var iconColor: String
  var pressedBackground: String
  var pressedColor: String
  var borderColor: String
  var borderWidth: Double
  var cornerRadius: Double
  var fontFamily: String?
  var fontSize: Double
  var fontWeight: String
  var iconSize: Double
}

extension KeyflowTheme {
  func styled(_ name: String) -> KeyflowTheme {
    guard let style = sections?[name] else { return self }
    var copy = self
    copy.sections = nil
    copy.strokeColor = style.borderColor
    copy.strokeWidth = style.borderWidth
    copy.background = style.background
    copy.keyBackground = style.background
    copy.specialKeyBackground = style.background
    copy.deleteKeyBackground = style.background
    copy.actionKeyBackground = style.background
    copy.keyForeground = style.color
    copy.specialKeyForeground = style.color
    copy.actionKeyForeground = style.color
    copy.pressedKeyBackground = style.pressedBackground
    if name == "selection" {
      copy.keyBackground = "#00000000"
      copy.pressedKeyBackground = style.background
      copy.selectedKeyBackground = style.background
      copy.selectedKeyForeground = style.color
    }
    copy.fontFamily = style.fontFamily
    copy.fontSize = style.fontSize
    copy.fontWeight = style.fontWeight
    copy.keyCornerRadius = style.cornerRadius
    return copy
  }
}
extension UIButton {
  func applyKeyflowStyle(_ theme: KeyflowTheme, section: String) {
    guard let style = theme.sections?[section] else { return }
    backgroundColor = UIColor(keyflowHex: style.background)
    setTitleColor(UIColor(keyflowHex: style.color), for: .normal)
    setTitleColor(UIColor(keyflowHex: style.pressedColor), for: .highlighted)
    tintColor = UIColor(keyflowHex: style.iconColor)
    titleLabel?.font = theme.styled(section).font(size: CGFloat(style.fontSize))
    titleLabel?.adjustsFontSizeToFitWidth = true
    layer.cornerRadius = CGFloat(style.cornerRadius)
    layer.borderColor = UIColor(keyflowHex: style.borderColor).cgColor
    layer.borderWidth = CGFloat(style.borderWidth)
    setPreferredSymbolConfiguration(
      UIImage.SymbolConfiguration(pointSize: CGFloat(style.iconSize)), forImageIn: .normal)
    let pressed = UIGraphicsImageRenderer(size: CGSize(width: 1, height: 1)).image { _ in
      UIColor(keyflowHex: style.pressedBackground).setFill()
      UIRectFill(CGRect(x: 0, y: 0, width: 1, height: 1))
    }
    setBackgroundImage(pressed, for: .highlighted)
    clipsToBounds = true
  }
}

struct KeyflowSectionOverrides: Decodable, Equatable {
  var color: String?
  var iconColor: String?
  var background: String?
  var cornerRadius: Double?
  var iconSize: Double?
  var fontSize: Double?
}
