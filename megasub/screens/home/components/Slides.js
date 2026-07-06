import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  FlatList,
  useWindowDimensions,
} from 'react-native';

// Reduced padding from 20 to 12 to increase the width and make it look expansive yet fitted
const PADDING = 16;

const SLIDES = [
  { id: '1', source: require('../../../assets/GLO 1.png') },
  { id: '2', source: require('./../../../assets/MTN 1.png') },
  { id: '3', source: require('../../../assets/AIRTEL 1.png') },
];

export default function Slide() {
  const { width: screenWidth } = useWindowDimensions();
  const carouselWidth = screenWidth - PADDING * 2;
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
          <View style={[styles.slideItem, { width: screenWidth }]}>
            <Image
              source={item.source}
              style={[styles.image, { width: carouselWidth }]}
              resizeMode="contain"
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
    marginVertical: 16,
  },
  slideItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PADDING,
  },
  image: {
    height: 190, // Adjusted slightly upward to match the wider display aspect ratio
    borderRadius: 10,
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