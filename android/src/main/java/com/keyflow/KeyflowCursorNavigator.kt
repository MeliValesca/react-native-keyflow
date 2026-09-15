package com.keyflow

import android.graphics.PointF
import android.widget.EditText

/** Resolve an unsnapped drag target through the editor's native text layout. */
internal class KeyflowCursorNavigator {
  private var origin: PointF? = null

  fun reset() {
    origin = null
  }

  fun begin(editor: EditText) {
    val layout =
      editor.layout
        ?: run {
          reset()
          return
        }
    val position = editor.selectionStart.coerceAtLeast(0)
    val line = layout.getLineForOffset(position)
    origin =
      PointF(
        layout.getPrimaryHorizontal(position),
        (layout.getLineTop(line) + layout.getLineBottom(line)) / 2f,
      )
  }

  fun move(editor: EditText, dx: Float, dy: Float) {
    if (origin == null) begin(editor)
    val anchor = origin ?: return
    val layout = editor.layout ?: return
    val line = layout.getLineForVertical((anchor.y + dy).toInt())
    val position = layout.getOffsetForHorizontal(line, anchor.x + dx)
    if (editor.selectionStart == position && editor.selectionEnd == position) return
    editor.setSelection(position)
    editor.bringPointIntoView(position)
  }
}
