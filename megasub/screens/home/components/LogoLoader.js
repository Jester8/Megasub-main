import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

const BRAND = '#4A55DD';

// Page loader: the Megasub logo in the centre with a ring spinning around it.
// `size` is the logo's width; the ring sits just outside it. `centered` puts it
// in the middle of the space below a screen's header instead of at the top.
export default function LogoLoader({ size = 72, centered = false, style }) {
  const { height } = useWindowDimensions();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const ring = size + 28;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const loader = (
    <View style={[styles.wrap, { width: ring, height: ring }, style]}>
      <Animated.View
        style={[
          styles.ring,
          { width: ring, height: ring, borderRadius: ring / 2, transform: [{ rotate }] },
        ]}
      />
      <Image
        source={require('../../../assets/app-icon-1024.png')}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
      />
    </View>
  );

  return centered ? <View style={[styles.centered, { minHeight: height * 0.65 }]}>{loader}</View> : loader;
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(74,85,221,0.15)',
    borderTopColor: BRAND,
  },
});
