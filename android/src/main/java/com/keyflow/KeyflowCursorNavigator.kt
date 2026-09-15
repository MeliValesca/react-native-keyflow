package com.keyflow

import android.widget.EditText
import java.text.BreakIterator
import java.util.Locale

internal class KeyflowCursorNavigator {
  private var preferredX: Float? = null

  fun reset() {
    preferredX = null
  }

  fun move(editor: EditText, horizontal: Int, vertical: Int) {
    var position = editor.selectionStart.coerceAtLeast(0)
    if (horizontal != 0) {
      reset()
      val iterator = BreakIterator.getCharacterInstance(Locale.ROOT)
      iterator.setText(editor.text.toString())
      repeat(kotlin.math.abs(horizontal)) {
        val next =
          if (horizontal < 0) iterator.preceding(position) else iterator.following(position)
        if (next != BreakIterator.DONE) position = next
      }
    }
    if (vertical != 0) {
      editor.layout?.let { layout ->
        val line = layout.getLineForOffset(position)
        if (preferredX == null) preferredX = layout.getPrimaryHorizontal(position)
        val target = (line + vertical).coerceIn(0, layout.lineCount - 1)
        position = layout.getOffsetForHorizontal(target, preferredX!!)
      }
    }
    editor.setSelection(position)
    editor.bringPointIntoView(position)
  }
}
