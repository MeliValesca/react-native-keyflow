import Foundation

/// Supported Latin layouts. Templates are explicit, not detected software layouts.
struct KeyflowLanguage: Equatable, Decodable {
  let language: String
  let layout: String
  var base: String { Locale(identifier: language).languageCode ?? "en" }
  var currency: String {
    base == "fr" && Locale(identifier: language).regionCode != "CA" ? "€" : "$"
  }
  var name: String { base == "fr" ? "Français" : "English" }
  var letterRows: [String] {
    layout == "azerty"
      ? ["azertyuiop", "qsdfghjklm", "wxcvbn"] : ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
  }
  static let english = KeyflowLanguage(language: "en", layout: "qwerty")
  static func resolve(json: String, preferred: [String]) -> [KeyflowLanguage] {
    if !json.isEmpty, let data = json.data(using: .utf8),
      let configured = try? JSONDecoder().decode([KeyflowLanguage].self, from: data)
    {
      let valid = configured.filter {
        ["en", "fr"].contains($0.base) && ["qwerty", "azerty"].contains($0.layout)
      }
      if !valid.isEmpty { return unique(valid) }
    }
    let supported = preferred.compactMap { tag -> KeyflowLanguage? in
      let locale = Locale(identifier: tag)
      guard let base = locale.languageCode, ["en", "fr"].contains(base),
        locale.scriptCode == nil || locale.scriptCode == "Latn"
      else { return nil }
      return KeyflowLanguage(
        language: tag, layout: base == "fr" && locale.regionCode != "CA" ? "azerty" : "qwerty")
    }
    return supported.isEmpty ? [.english] : unique(supported)
  }
  private static func unique(_ values: [KeyflowLanguage]) -> [KeyflowLanguage] {
    var seen = Set<String>()
    return values.filter { seen.insert($0.base).inserted }
  }
  func dictionary(in available: [String]) -> String? {
    let normalized = language.replacingOccurrences(of: "-", with: "_").lowercased()
    return available.first {
      $0.replacingOccurrences(of: "-", with: "_").lowercased() == normalized
    }
      ?? available.first { Locale(identifier: $0).languageCode == base }
  }
}
