import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#4A55DD',
  primaryDark: '#3340B8',
  white: '#FFFFFF',
  whiteAlpha80: 'rgba(255,255,255,0.80)',
  whiteAlpha20: 'rgba(255,255,255,0.20)',
  whiteAlpha10: 'rgba(255,255,255,0.10)',
};

const FONTS = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const slides = [
  {
    id: '1',
    image: require('../assets/slide1.png'),
    title: 'Easy Data Purchase',
    subtitle: 'Purchase data plans hassle-free with just a few taps.',
  },
  {
    id: '2',
    image: require('../assets/slide2.png'),
    title: 'Convenient Airtime Purchase',
    subtitle: 'Easily recharge your mobile airtime within seconds.',
  },
  {
    id: '3',
    image: require('../assets/slide3.png'), 
    title: 'Streamlined Cable Subscription',
    subtitle: 'Subscribe to cable TV packages effortlessly from your mobile device.',
  },
];

function SlideItem({ item }) {
  return (
    <View style={[styles.slideContainer, { width }]}>
      <Image source={item.image} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.darkOverlay} />
      <LinearGradient
        colors={[
          'transparent',
          'rgba(8,10,30,0.55)',
          'rgba(5,7,22,0.82)',
          'rgba(3,5,18,0.97)',
        ]}
        locations={[0, 0.35, 0.65, 1]}
        style={styles.gradientScrim}
      />
      <View style={styles.textContent}>
        {/* <View style={styles.accentPill}>
          <View style={styles.accentDot} />
          <Text style={styles.accentLabel}>Megasub</Text>
        </View> */}
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );
}

function DotIndicator({ count, activeIndex }) {
  return (
    <View style={styles.dotRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen({ navigate }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  function handleNext() {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      navigate('signup');
    }
  }

  function handleSkip() {
    flatListRef.current?.scrollToIndex({ index: slides.length - 1, animated: true });
  }

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {!isLastSlide && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => <SlideItem item={item} />}
      />

      <View style={styles.bottomBar}>
        <DotIndicator count={slides.length} activeIndex={currentIndex} />

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nextBtnGradient}
          >
            <Text style={styles.nextBtnText}>
              {isLastSlide ? 'Get Started' : 'Next'}
            </Text>
            {/* {!isLastSlide && (
              <View style={styles.arrowCircle}>
                <Text style={styles.arrowText}>→</Text>
              </View>
            )} */}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030512' },
  skipBtn: {
    position: 'absolute', top: 56, right: 24, zIndex: 20,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'transparent', borderWidth: 1,
    borderColor: COLORS.whiteAlpha20,
  },
  skipText: { fontFamily: FONTS.semibold, fontSize: 13, color: COLORS.whiteAlpha80 },
  slideContainer: { height, position: 'relative' },
  bgImage: { position: 'absolute', top: 0, left: 0, width, height },
  darkOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  gradientScrim: {
    position: 'absolute', top: height * 0.3, left: 0, right: 0, bottom: 0,
  },
  textContent: { position: 'absolute', bottom: 148, left: 28, right: 28 },
  accentPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: COLORS.whiteAlpha10, borderWidth: 1,
    borderColor: COLORS.primary, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 16, gap: 6,
  },
  accentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  accentLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: COLORS.primary, letterSpacing: 0.5 },
  slideTitle: {
    fontFamily: FONTS.extrabold, fontSize: 32, color: COLORS.white,
    lineHeight: 40, marginBottom: 12, letterSpacing: -0.5,
  },
  slideSubtitle: { fontFamily: FONTS.regular, fontSize: 15, color: COLORS.whiteAlpha80, lineHeight: 24 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 28, paddingBottom: 52, paddingTop: 16,
  },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 28, backgroundColor: COLORS.primary },
  dotInactive: { width: 8, backgroundColor: COLORS.whiteAlpha20 },
  nextBtn: {
    borderRadius: 50, overflow: 'hidden', elevation: 8,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.55, shadowRadius: 14,
  },
  nextBtnGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 15, gap: 10 },
  nextBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.white },
  arrowCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.whiteAlpha20, alignItems: 'center', justifyContent: 'center',
  },
  arrowText: { color: COLORS.white, fontSize: 13, lineHeight: 16 },
});