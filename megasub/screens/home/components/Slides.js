import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useResponsive } from '../../../lib/responsive';

// Matches WalletCard's wrapper paddingHorizontal so the slide spans the same width
const PADDING = 16;

const SLIDES = [
  { id: '1', source: require('../../../assets/slide-glo.png') },
  { id: '2', source: require('../../../assets/slide-mtn.png') },
  { id: '3', source: require('../../../assets/slide-airtel.png') },
];

export default function Slide() {
  // A page must be exactly as wide as the column it sits in, or paging snaps
  // to the wrong offsets — on a tablet that column is capped, not the screen.
  const { isTablet, contentWidth } = useResponsive();
  const carouselWidth = contentWidth - PADDING * 2;
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);

  // Auto-slide loop effect
  useEffect(() => {
    const timer = setInterval(() => {
      let nextIndex = activeIndex + 1;
      if (nextIndex >= SLIDES.length) {
        nextIndex = 0;
      }
      
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      
      setActiveIndex(nextIndex);
    }, 3000);

    return () => clearInterval(timer);
  }, [activeIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={[styles.slideItem, { width: contentWidth }]}>
            <Image
              source={item.source}
              style={[styles.image, { width: carouselWidth }, isTablet && styles.imageTablet]}
              resizeMode="cover"
            />
          </View>
        )}
      />

      {/* Indicator Dots Layout Container */}
      <View style={styles.indicatorContainer}>
        {SLIDES.map((_, index) => {
          const isActive = index === activeIndex;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                isActive ? styles.dotActive : styles.dotInactive,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
  },
  slideItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PADDING,
  },
  image: {
    height: 160, // Matches WalletCard's minHeight so both cards read as the same size
    borderRadius: 20, // Matches WalletCard's borderRadius
  },
  imageTablet: {
    height: 140, // Matches WalletCard's cardTablet minHeight
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18, 
    backgroundColor: '#4A55DD',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(11,13,26,0.15)',
  },
});