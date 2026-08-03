import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { getExerciseGif } from './exerciseDBService';
import { colors } from '../lib/theme';

/**
 * Small looping preview of an exercise.
 *
 * The gifs were sourced and re-hosted, and 156 of them sit in `exercise_gifs`
 * covering every exercise a generated program can produce — but nothing showed
 * one unless the user first knew to tap the exercise name. Mid-workout, the
 * moment the picture is actually worth something, the set list was text only.
 *
 * Renders nothing at all when there is no gif for the name: coverage is not
 * total (band and bodyweight accessories are thin), and an empty grey box is
 * worse than no box. The caller's layout must tolerate this returning null.
 */
export default function ExerciseGifThumb({ name, size = 44, style }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let live = true;
    setUrl(null);
    if (name) getExerciseGif(name).then(u => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [name]);

  if (!url) return null;

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.22 }, style]}>
      <Image
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        autoplay
        // The thumbnail is decorative — the exercise name next to it already
        // carries the meaning, so announcing the image again is just noise.
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
