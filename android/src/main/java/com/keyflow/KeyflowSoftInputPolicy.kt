package com.keyflow

import android.widget.EditText

/** React owns its TextInput prop; native editors need temporary policy changes. */
internal class KeyflowSoftInputPolicy {
  private var reactManaged = false
  private var saved = true

  fun remember(editor: EditText, managedByReact: Boolean) {
    reactManaged = managedByReact
    saved = editor.showSoftInputOnFocus
  }

  fun apply(editor: EditText, show: Boolean) {
    if (!reactManaged) editor.showSoftInputOnFocus = show
  }

  fun restore(editor: EditText) {
    if (!reactManaged) editor.showSoftInputOnFocus = saved
  }
}
