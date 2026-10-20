import { useWindowDimensions } from 'react-native';

// A tablet is anything whose *shorter* side is 600pt or more, so a device
// stays a tablet in both orientations instead of flipping category when the
// user rotates it.
const TABLET_MIN_DIMENSION = 600;

// Tablets use the full screen width, the same layout as phones, only wider
// (product decision, 2026-10-20). Earlier versions capped screens to a
// centred 440-560pt column; `column` and `content` are kept as null so every
// screen that spreads them into a style array keeps working unchanged.
// Dialogs and sheets stay capped: a pop-up stretched across a 13-inch iPad
// reads as broken rather than spacious.
const TABLET_DIALOG_WIDTH = 440;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN_DIMENSION;

  return {
    isTablet,
    column: null,
    content: null,
    dialog: isTablet ? { maxWidth: TABLET_DIALOG_WIDTH } : null,
    // The width the content actually occupies, in points. Children that must
    // compute a size (carousel pages, grid columns) measure against this.
    contentWidth: width,
  };
}
