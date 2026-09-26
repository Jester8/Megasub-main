import { Image } from 'react-native';

// The home promo slides are bundled with the app, so they never need a network
// fetch or storage; what makes them appear late is decoding four large images
// after Home has already rendered. Warming them during the boot loader means
// the slider is ready the moment Home shows.
export const SLIDE_SOURCES = [
  require('../assets/slide-glo.png'),
  require('../assets/slide-mtn.png'),
  require('../assets/slide-airtel.png'),
  require('../assets/slide-9mobile.png'),
];

// Resolves once every slide is decoded and cached, or after `timeoutMs`, so a
// slow device never holds the app on the loader.
export function preloadSlides(timeoutMs = 2500) {
  const loads = SLIDE_SOURCES.map((source) => {
    const { uri } = Image.resolveAssetSource(source) || {};
    return uri ? Image.prefetch(uri).catch(() => false) : Promise.resolve(false);
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([Promise.all(loads), timeout]);
}
