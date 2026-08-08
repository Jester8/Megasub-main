import { useWindowDimensions } from 'react-native';

// A tablet is anything whose *shorter* side is 600pt or more, so a device
// stays a tablet in both orientations instead of flipping category when the
// user rotates it.
const TABLET_MIN_DIMENSION = 600;

// The auth screens were laid out phone-first (everything full-width inside
// 24pt gutters), which leaves inputs and buttons stretched edge to edge on a
// tablet. Capping the content column keeps them a comfortable reading width
// and centres them; phones never hit the cap, so their layout is untouched.
const TABLET_COLUMN_WIDTH = 440;

// The home dashboard gets a wider column than the auth forms: it holds cards
// and a 4-across service grid rather than one stack of inputs, and 440 would
// squeeze those. Still far below a tablet's full width, which is the point.
export const TABLET_CONTENT_WIDTH = 560;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN_DIMENSION;

  return {
    isTablet,
    // Null on phones so screens can spread this unconditionally into a style
    // array without changing anything on a phone.
    column: isTablet
      ? { width: '100%', maxWidth: TABLET_COLUMN_WIDTH, alignSelf: 'center' }
      : null,
    // Modals/sheets already size themselves off the viewport — this caps them
    // to the same column so they don't span the whole tablet screen.
    dialog: isTablet ? { maxWidth: TABLET_COLUMN_WIDTH } : null,
    content: isTablet
      ? { width: '100%', maxWidth: TABLET_CONTENT_WIDTH, alignSelf: 'center' }
      : null,
    // The width the content column actually occupies, in points. Children that
    // must compute a size (carousel pages, grid columns) have to measure
    // against this rather than useWindowDimensions, or they overflow the
    // column on a tablet.
    contentWidth: isTablet ? Math.min(width, TABLET_CONTENT_WIDTH) : width,
  };
}
