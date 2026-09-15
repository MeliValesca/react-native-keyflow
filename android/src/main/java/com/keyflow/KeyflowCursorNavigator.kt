package com.keyflow

import android.graphics.PointF
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.Drawable
import android.widget.EditText

/** Resolve an unsnapped drag target through the editor's native text layout. */
internal class KeyflowCursorNavigator {
  private var origin: PointF? = null
  private var editor: EditText? = null
  private var cursorVisible = true
  internal var floatingCaret: Drawable? = null
    private set

  fun reset() {
    editor?.let { input ->
      floatingCaret?.let { input.overlay.remove(it) }
      input.isCursorVisible = cursorVisible
    }
    editor = null
    floatingCaret = null
    origin = null
  }

  fun begin(editor: EditText) {
    reset()
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
    if (this.editor == null) {
      this.editor = editor
      cursorVisible = editor.isCursorVisible
      floatingCaret =
        editor.textCursorDrawable?.constantState?.newDrawable()?.mutate()
          ?: ColorDrawable(editor.currentTextColor)
      editor.overlay.add(floatingCaret!!)
      editor.isCursorVisible = false
    }
    if (editor.selectionStart != position || editor.selectionEnd != position) {
      editor.setSelection(position)
      editor.bringPointIntoView(position)
    }
    val width =
      (2 * editor.resources.displayMetrics.density).coerceAtLeast(
        floatingCaret?.intrinsicWidth?.toFloat() ?: 1f
      )
    val height = (layout.getLineBottom(line) - layout.getLineTop(line)).toFloat()
    val x =
      (anchor.x + dx + editor.totalPaddingLeft - editor.scrollX).coerceIn(
        width / 2,
        (editor.width - width / 2).coerceAtLeast(width / 2),
      )
    val y =
      (anchor.y + dy + editor.totalPaddingTop - editor.scrollY).coerceIn(
        height / 2,
        (editor.height - height / 2).coerceAtLeast(height / 2),
      )
    floatingCaret?.setBounds(
      (x - width / 2).toInt(),
      (y - height / 2).toInt(),
      (x + width / 2).toInt(),
      (y + height / 2).toInt(),
    )
    floatingCaret?.invalidateSelf()
  }
}
