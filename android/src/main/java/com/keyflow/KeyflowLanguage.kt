package com.keyflow

import java.util.Locale
import org.json.JSONArray

internal data class KeyflowLanguage(val language: String, val layout: String) {
  val locale: Locale
    get() = Locale.forLanguageTag(language.replace('_', '-'))

  val base: String
    get() = locale.language

  val currency: String
    get() = if (base == "fr" && locale.country != "CA") "€" else "$"

  val name: String
    get() = if (base == "fr") "Français" else "English"

  val letterRows: List<String>
    get() =
      if (layout == "azerty") listOf("azertyuiop", "qsdfghjklm", "wxcvbn")
      else listOf("qwertyuiop", "asdfghjkl", "zxcvbnm")

  companion object {
    val english = KeyflowLanguage("en", "qwerty")

    fun resolve(json: String, preferred: List<String>): List<KeyflowLanguage> {
      if (json.isNotEmpty()) {
        val configured =
          runCatching {
              val array = JSONArray(json)
              (0 until array.length())
                .map {
                  val item = array.getJSONObject(it)
                  KeyflowLanguage(item.getString("language"), item.getString("layout"))
                }
                .filter { it.base in listOf("en", "fr") && it.layout in listOf("qwerty", "azerty") }
                .distinctBy { it.base }
            }
            .getOrNull()
        if (!configured.isNullOrEmpty()) return configured
      }
      return preferred
        .mapNotNull { tag ->
          val locale = Locale.forLanguageTag(tag.replace('_', '-'))
          if (locale.language !in listOf("en", "fr") || locale.script !in listOf("", "Latn")) null
          else
            KeyflowLanguage(
              tag,
              if (locale.language == "fr" && locale.country != "CA") "azerty" else "qwerty",
            )
        }
        .distinctBy { it.base }
        .ifEmpty { listOf(english) }
    }
  }
}
