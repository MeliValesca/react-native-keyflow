import UIKit

/// Positions existing keys without owning editing or gesture state.
struct KeyflowKeyboardLayout {
  let isTablet: Bool
  let isPad: Bool
  let landscape: Bool
  let viewportSize: CGSize
  let safeInsets: UIEdgeInsets
  let tabletBasis: CGFloat
  let rowHeight: CGFloat
  let typingTop: CGFloat
  let canSwitchLanguage: Bool
  let page: KeyflowKeyboardPage
  func apply(to rows: [[KeyflowKey]], in bounds: CGRect) {
    // The device clips the bottom edge; only the panel background rounds at top.
    let width = bounds.width
    // UIKit trims the iPad accessory host slightly, while the system keyboard
    // still lays keys out on the full window grid.
    let tabletHostTrim = tabletBasis * (landscape ? 8.0 / 834.0 : 4.0 / 834.0)
    let layoutWidth = isTablet ? max(width, viewportSize.width) + tabletHostTrim : width
    let horizontalInset: CGFloat =
      isTablet
      ? layoutWidth * (landscape ? 12.0 / 1218.0 : 6.0 / 834.0)
      : 3.5 + (landscape ? max(safeInsets.left, safeInsets.right) + 10.5 : 0)
    let usableWidth = layoutWidth - horizontalInset * 2
    let unit = usableWidth / 10
    for (rowIndex, row) in rows.enumerated() {
      let y = typingTop + CGFloat(rowIndex) * rowHeight
      if isPad {
        place(
          row, x: horizontalInset, y: y, widths: Array(repeating: usableWidth / 3, count: row.count)
        )
      } else if isTablet {
        layoutTabletRow(row, index: rowIndex, x: horizontalInset, y: y, width: usableWidth)
      } else if rowIndex == 0 {
        place(row, x: horizontalInset, y: y, widths: Array(repeating: unit, count: row.count))
      } else if rowIndex == 1 {
        let isLetters = page == .letters
        let itemWidth = isLetters ? unit : usableWidth / CGFloat(row.count)
        place(
          row,
          x: horizontalInset + (isLetters ? (usableWidth - CGFloat(row.count) * itemWidth) / 2 : 0),
          y: y, widths: Array(repeating: itemWidth, count: row.count))
      } else if rowIndex == 2 {
        let sideWidth = unit * 1.3
        let middleCount = row.count - 2
        let middleWidth = page == .letters ? unit : unit * 1.4
        row[0].frame = CGRect(x: horizontalInset, y: y, width: sideWidth, height: rowHeight)
        place(
          Array(row.dropFirst().dropLast()), x: (width - CGFloat(middleCount) * middleWidth) / 2,
          y: y, widths: Array(repeating: middleWidth, count: middleCount))
        row[row.count - 1].frame = CGRect(
          x: width - horizontalInset - sideWidth, y: y, width: sideWidth, height: rowHeight)
      } else {
        if canSwitchLanguage {
          place(
            row, x: horizontalInset, y: y,
            widths: [
              usableWidth * 0.15, usableWidth * 0.12, usableWidth * 0.48, usableWidth * 0.25,
            ])
          continue
        }
        place(
          row, x: horizontalInset, y: y,
          widths: landscape
            ? [usableWidth * 0.2, usableWidth * 0.6, usableWidth * 0.2]
            : [usableWidth * 0.25, usableWidth * 0.50, usableWidth * 0.25])
      }
    }
  }

  private func layoutTabletRow(
    _ row: [KeyflowKey], index: Int, x: CGFloat, y: CGFloat, width: CGFloat
  ) {
    let unit = width / 12
    switch index {
    case 0:
      place(
        row, x: x, y: y,
        widths: [unit * 1.2] + Array(repeating: unit * 0.96, count: 10) + [unit * 1.2])
    case 1:
      let middle = row.count - 2
      place(
        row, x: x, y: y,
        widths: [unit * 1.5] + Array(repeating: unit * 0.9583, count: middle) + [unit * 1.875])
    case 2:
      let middle = row.count - 2
      place(
        row, x: x, y: y,
        widths: [unit * 1.92] + Array(repeating: unit * 0.96, count: middle) + [unit * 1.44])
    default:
      // Unsupported emoji and microphone controls are omitted. Redistribute
      // their slots so the remaining controls form one continuous dock.
      if row.count == 5 {
        place(
          row, x: x, y: y,
          widths: [
            width * 0.0841, width * 0.0848, width * 0.5914, width * 0.11985, width * 0.11985,
          ])
      } else if landscape {
        place(row, x: x, y: y, widths: [width * 0.102, width * 0.61, width * 0.144, width * 0.144])
      } else {
        place(
          row, x: x, y: y,
          widths: [width * 0.1689, width * 0.5914, width * 0.11985, width * 0.11985])
      }
    }
  }

  private func place(_ keys: [KeyflowKey], x: CGFloat, y: CGFloat, widths: [CGFloat]) {
    var nextX = x
    for (index, key) in keys.enumerated() {
      key.frame = CGRect(x: nextX, y: y, width: widths[index], height: rowHeight)
      nextX += widths[index]
    }
  }

}
