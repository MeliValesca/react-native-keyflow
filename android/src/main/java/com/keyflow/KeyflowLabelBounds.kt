package com.keyflow

/** Text clearance shared by rendering and diagnostics. */
internal object KeyflowLabelBounds {
  fun horizontalInsetDp(action: String) =
    if (action == "numbers" || action == "letters") 10f else 6f
}
