import Foundation

func expect(_ condition: Bool, _ message: String) { precondition(condition, message) }
let list = KeyflowLanguage.resolve(json: "", preferred: ["ko-KR", "fr-CA", "en-GB", "fr-FR", "ja-JP", "emoji"])
expect(list.map { $0.base } == ["fr", "en"], "Filter unsupported languages and deduplicate without reordering")
expect(list.map { $0.layout } == ["qwerty", "qwerty"], "Canadian French template")
let french = KeyflowLanguage.resolve(json: "", preferred: ["fr-FR"])[0]
expect(french.layout == "azerty", "France template")
expect(french.letterRows.joined().sorted() == "abcdefghijklmnopqrstuvwxyz".sorted(), "AZERTY contains every Latin letter exactly once")
expect(KeyflowLanguage.english.letterRows.joined().sorted() == "abcdefghijklmnopqrstuvwxyz".sorted(), "QWERTY contains every Latin letter exactly once")
expect(KeyflowLanguage.resolve(json: "", preferred: ["zh-CN", "ko-KR", "ja-JP"]) == [.english], "Unsupported-only fallback")
expect(KeyflowLanguage.resolve(json: "", preferred: []) == [.english], "Empty preferences fallback")
expect(KeyflowLanguage.resolve(json: "", preferred: ["fr-Cyrl"]) == [.english], "Reject non-Latin script")
let override = KeyflowLanguage.resolve(json: "[{\"language\":\"fr\",\"layout\":\"qwerty\"},{\"language\":\"en\",\"layout\":\"qwerty\"}]", preferred: ["ja"])
expect(override[0].base == "fr" && override[0].layout == "qwerty", "Explicit layout and ordering")
expect(french.dictionary(in: ["en_US", "fr_CA", "fr_FR"]) == "fr_FR", "Exact dictionary")
expect(french.dictionary(in: ["en_US", "fr_CA"]) == "fr_CA", "Same-language regional fallback")
expect(french.dictionary(in: ["en_US"]) == nil, "Never correct French with English dictionary")
expect(french.currency == "€" && list[0].currency == "$", "French and Canadian currency templates")
print("PASS: 12 language resolution and catalogue checks")
