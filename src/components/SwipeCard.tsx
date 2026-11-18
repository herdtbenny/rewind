import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useImperativeHandle, type Ref } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Photo } from '../media';
import { formatDate } from '../periods';
import type { Decision } from '../storage';
import { colors, radius } from '../theme';

export type SwipeCardHandle = { swipe: (d: Decision) => void };

type Props = {
  photo: Photo;
  onDecide: (photo: Photo, d: Decision) => void;
  /** Nach „Rückgängig“ fliegt die Karte von dieser Seite wieder herein. */
  enterFrom?: Decision;
  ref?: Ref<SwipeCardHandle>;
};

export function SwipeCard({ photo, onDecide, enterFrom, ref }: Props) {
  const { width } = useWindowDimensions();
  const offscreen = width * 1.4;
  const x = useSharedValue(enterFrom === 'trash' ? -offscreen : enterFrom === 'keep' ? offscreen : 0);
  const y = useSharedValue(0);
  const locked = useSharedValue(false);
  const threshold = width * 0.28;

  useEffect(() => {
    if (enterFrom) x.set(withSpring(0, { damping: 18, stiffness: 180 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (d: Decision) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDecide(photo, d);
  };

  const flyOut = (d: Decision) => {
    'worklet';
    if (locked.get()) return;
    locked.set(true);
    x.set(
      withTiming(d === 'keep' ? offscreen : -offscreen, { duration: 220 }, (done) => {
        if (done) scheduleOnRN(finish, d);
      }),
    );
  };

  useImperativeHandle(ref, () => ({ swipe: (d: Decision) => flyOut(d) }));

  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      if (locked.get()) return;
      x.set(e.translationX);
      y.set(e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (locked.get()) return;
      const fast = Math.abs(e.velocityX) > 900;
      if (e.translationX > threshold || (fast && e.velocityX > 0)) flyOut('keep');
      else if (e.translationX < -threshold || (fast && e.velocityX < 0)) flyOut('trash');
      else {
        x.set(withSpring(0, { damping: 16, stiffness: 200 }));
      }
      y.set(withSpring(0, { damping: 16, stiffness: 200 }));
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() * 0.3 },
      { rotate: `${interpolate(x.get(), [-width, width], [-14, 14])}deg` },
    ],
  }));
  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, threshold], [0, 1], Extrapolation.CLAMP),
  }));
  const trashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [-threshold, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]} testID="swipe-card">
        <Image
          source={{ uri: photo.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={120}
          recyclingKey={photo.id}
        />
        <View style={styles.footer} pointerEvents="none">
          <Text style={styles.date}>{formatDate(photo.creationTime)}</Text>
        </View>
        <Animated.View style={[styles.stamp, styles.stampKeep, keepStyle]} pointerEvents="none">
          <Text style={[styles.stampText, { color: colors.keep }]}>BEHALTEN</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampTrash, trashStyle]} pointerEvents="none">
          <Text style={[styles.stampText, { color: colors.trash }]}>WEG DAMIT</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Statische Karte, die hinter der aktuellen liegt. */
export function NextCard({ photo }: { photo: Photo }) {
  return (
    <View style={[styles.card, styles.next]}>
      <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="contain" recyclingKey={photo.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    backgroundColor: '#000',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  next: { transform: [{ scale: 0.94 }], opacity: 0.6 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  date: { color: colors.text, fontSize: 15, fontWeight: '600' },
  stamp: {
    position: 'absolute',
    top: 28,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  stampKeep: { left: 22, borderColor: colors.keep, transform: [{ rotate: '-12deg' }] },
  stampTrash: { right: 22, borderColor: colors.trash, transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: 26, fontWeight: '900', letterSpacing: 1.5 },
});
