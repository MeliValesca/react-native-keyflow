package com.keyflow

import android.content.res.Resources
import kotlin.math.roundToInt

/** Geometry calibrated against Gboard 15.1 phone and tablet docks. */
internal class KeyflowGeometry(private val resources: Resources) {
  val landscape
    get() =
      resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE

  val tablet
    get() = resources.configuration.smallestScreenWidthDp >= 600

  private val tabletBasis
    get() = resources.configuration.smallestScreenWidthDp.toFloat()

  private val width
    get() = resources.configuration.screenWidthDp.toFloat().coerceIn(320f, 480f)

  private val scale
    get() = ((width - 320f) / 91f).coerceIn(0f, 1.75f)

  // Measured from the docked Gboard 16 tablet layout on the Pixel Tablet
  // profile. A resized phone AVD reports tablet dp values but keeps Gboard's
  // phone/floating policy, so it is not a valid calibration target.
  val rowHeight
    get() =
      if (tablet) (tabletBasis * 0.0825f).roundToInt()
      else if (landscape) 43 else (48 + 11 * scale).roundToInt()

  val toolbarHeight
    get() =
      if (tablet) (tabletBasis * 0.06f).roundToInt()
      else if (landscape) 42 else (42 + 6 * scale).roundToInt()

  val bottomInset
    get() =
      if (tablet) (tabletBasis * 0.0275f).roundToInt()
      else if (landscape) 0 else (2 + 4 * scale).roundToInt()

  val horizontalGutter
    get() = if (tablet) (if (landscape) 6 else 5) else if (width < 360) 2 else 3

  val verticalGutter
    get() =
      if (tablet) (rowHeight * 0.09f).roundToInt()
      else if (landscape) 2 else if (width < 360) 5 else 6

  // Gboard's 411dp portrait labels render at roughly 26sp. Scaling to 28sp
  // made Keyflow's Roboto glyphs visibly taller even when their bounds still
  // passed the loose visual tolerance used by the original regression.
  val letterSize
    get() = if (tablet) rowHeight * 0.465f else if (landscape) 24f else 22 + 4 * scale

  val bodyHeight
    get() = toolbarHeight + 4 * rowHeight + bottomInset
}
