// ExerciseImageSlideshow.js
// Drop this anywhere you render an exercise name.
// Shows start → end position images from free-exercise-db (no API key, free forever).
//
// Usage:
//   import ExerciseImageSlideshow from './ExerciseImageSlideshow';
//   <ExerciseImageSlideshow exerciseName="Barbell Bench Press" />

import { useState, useRef } from 'react';
import {
  View, Image, Text, Pressable,
  ScrollView, StyleSheet, Dimensions,
  ActivityIndicator,
} from 'react-native';
import { getExerciseImages } from './exerciseImageMatcher';

const { width: SCREEN_W } = Dimensions.get('window');
const SLIDE_W = SCREEN_W - 40; // 20px margin each side

const LABELS = ['Start position', 'End position'];

export default function ExerciseImageSlideshow({ exerciseName, style }) {
  const images = getExerciseImages(exerciseName);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadStates, setLoadStates] = useState({ 0: 'loading', 1: 'loading' });
  const scrollRef = useRef(null);

  // No match in our map — render nothing
  if (!images) return null;

  const slides = [images.start, images.end];

  function goTo(index) {
    scrollRef.current?.scrollTo({ x: index * SLIDE_W, animated: true });
    setActiveIndex(index);
  }

  function handleScroll(e) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
    setActiveIndex(index);
  }

  function setLoaded(index) {
    setLoadStates(prev => ({ ...prev, [index]: 'loaded' }));
  }

  function setError(index) {
    setLoadStates(prev => ({ ...prev, [index]: 'error' }));
  }

  return (
    <View style={[styles.container, style]}>

      {/* Label row */}
      <View style={styles.labelRow}>
        {LABELS.map((label, i) => (
          <Pressable key={i} onPress={() => goTo(i)} style={styles.labelBtn}>
            <Text style={[styles.labelText, activeIndex === i && styles.labelTextActive]}>
              {label}
            </Text>
            {activeIndex === i && <View style={styles.labelUnderline} />}
          </Pressable>
        ))}
      </View>

      {/* Scrollable image slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={{ width: SLIDE_W * slides.length }}
      >
        {slides.map((uri, i) => (
          <View key={i} style={[styles.slide, { width: SLIDE_W }]}>
            {loadStates[i] === 'loading' && (
              <View style={styles.placeholder}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            )}
            {loadStates[i] === 'error' && (
              <View style={styles.placeholder}>
                <Text style={styles.errorText}>Image unavailable</Text>
              </View>
            )}
            <Image
              source={{ uri }}
              style={[
                styles.image,
                loadStates[i] !== 'loaded' && styles.imageHidden,
              ]}
              resizeMode="contain"
              onLoad={() => setLoaded(i)}
              onError={() => setError(i)}
            />
          </View>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <Pressable key={i} onPress={() => goTo(i)}>
            <View style={[styles.dot, activeIndex === i && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111114',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#2C2C35',
  },

  // Label tabs
  labelRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C35',
  },
  labelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8A94',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelTextActive: {
    color: '#FFFFFF',
  },
  labelUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },

  // Scroll
  scroll: {
    width: SLIDE_W,
  },
  slide: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F18',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageHidden: {
    width: 0,
    height: 0,
  },
  placeholder: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F18',
  },
  errorText: {
    fontSize: 12,
    color: '#8A8A94',
  },

  // Dots
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#111114',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#2C2C35',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 16,
  },
});
