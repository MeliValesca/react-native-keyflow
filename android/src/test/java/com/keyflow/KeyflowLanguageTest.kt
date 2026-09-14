package com.keyflow

import org.junit.Assert.*
import org.junit.Test

class KeyflowLanguageTest {
  @Test
  fun filtersUnsupportedAndPreservesOrder() {
    val values = KeyflowLanguage.resolve("", listOf("ko-KR", "fr-CA", "en-GB", "fr-FR", "ja-JP"))
    assertEquals(listOf("fr", "en"), values.map { it.base })
    assertEquals(listOf("qwerty", "qwerty"), values.map { it.layout })
  }

  @Test
  fun usesFrenchTemplateAndIncludesAllLetters() {
    val french = KeyflowLanguage.resolve("", listOf("fr-FR"))[0]
    assertEquals("azerty", french.layout)
    assertEquals("€", french.currency)
    assertEquals("$", KeyflowLanguage.resolve("", listOf("fr-CA"))[0].currency)
    for (language in listOf(french, KeyflowLanguage.english)) {
      assertEquals(
        "abcdefghijklmnopqrstuvwxyz".toList(),
        language.letterRows.joinToString("").toList().sorted(),
      )
    }
  }

  @Test
  fun unsupportedAndEmptyPreferencesHaveSafeFallback() {
    for (preferences in listOf(emptyList(), listOf("ko", "ja", "zh"), listOf("fr-Cyrl"))) {
      assertEquals(listOf(KeyflowLanguage.english), KeyflowLanguage.resolve("", preferences))
    }
  }
}
