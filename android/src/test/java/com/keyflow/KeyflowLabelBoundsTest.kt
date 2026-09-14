package com.keyflow

import org.junit.Assert.assertEquals
import org.junit.Test

class KeyflowLabelBoundsTest {
  @Test
  fun usesOneInsetRuleForWideLettersAndPageControls() {
    assertEquals(6f, KeyflowLabelBounds.horizontalInsetDp("letter"))
    assertEquals(10f, KeyflowLabelBounds.horizontalInsetDp("numbers"))
    assertEquals(10f, KeyflowLabelBounds.horizontalInsetDp("letters"))
  }
}
