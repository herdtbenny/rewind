import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { formatDuration, getVideoUri, type Photo } from '../media';
import { formatDate } from '../periods';
import { colors, radius } from '../theme';

/** Richtung einer Entscheidung: links weg, rechts behalten, oben Favorit (= behalten + Herz). */
export type Swipe = 'trash' | 'keep' | 'fav';

/** swipe() liefert false, wenn die Karte gerade schon rausfliegt. */
export type SwipeCardHandle = { swipe: (d: Swipe) => boolean };

type Props = {
  photo: Photo;
  onDecide: (photo: Photo, d: Swipe) => void;
  /** Nach „Rückgängig“ fliegt die Karte aus dieser Richtung wieder herein. */
  enterFrom?: Swipe;
  /** Anzahl der noch offenen Fotos dieser Serie (inkl. diesem), 0/1 = keine Serie. */
  seriesCount?: number;
  onCompare?: () => void;
  ref?: Ref<SwipeCardHandle>;
};

export function SwipeCard({ photo, onDecide, enterFrom, seriesCount = 0, onCompare, ref }: Props) {
  const { width, height } = useWindowDimensions();
  const offX = width * 1.4;
  const offY = height * 1.1;
  const x = useSharedValue(enterFrom === 'trash' ? -offX : enterFrom === 'keep' ? offX : 0);
  const y = useSharedValue(enterFrom === 'fav' ? -offY : 0);
  const scale = useSharedValue(1);
  const locked = useSharedValue(false);
  const threshold = width * 0.28;
  const upThreshold = height * 0.16;
  const isSeries = seriesCount > 1 && !!onCompare;

  useEffect(() => {
    if (enterFrom) {
      x.set(withSpring(0, { damping: 18, stiffness: 180 }));
      y.set(withSpring(0, { damping: 18, stiffness: 180 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (d: Swipe) => {
    Haptics.impactAsync(d === 'fav' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(
      () => {},
    );
    onDecide(photo, d);
  };

  const flyOut = (d: Swipe) => {
    'worklet';
    if (locked.get()) return;
    locked.set(true);
    const done = (ok?: boolean) => {
      'worklet';
      if (ok) scheduleOnRN(finish, d);
    };
    if (d === 'fav') {
      y.set(withTiming(-offY, { duration: 240 }, done));
    } else {
      x.set(withTiming(d === 'keep' ? offX : -offX, { duration: 220 }, done));
    }
  };

  useImperativeHandle(ref, () => ({
    swipe: (d: Swipe) => {
      if (locked.get()) return false;
      flyOut(d);
      return true;
    },
  }));

  const pan = usePanGesture({
    maxPointers: 1,
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
      const up = e.translationY < -upThreshold || e.velocityY < -1100;
      if (up && Math.abs(e.translationX) < threshold) flyOut('fav');
      else if (e.translationX > threshold || (fast && e.velocityX > 0)) flyOut('keep');
      else if (e.translationX < -threshold || (fast && e.velocityX < 0)) flyOut('trash');
      else {
        x.set(withSpring(0, { damping: 16, stiffness: 200 }));
        y.set(withSpring(0, { damping: 16, stiffness: 200 }));
      }
    },
  });

  // Mit zwei Fingern zusammenziehen = Serie vergleichen („rauszoomen“)
  const pinch = usePinchGesture({
    enabled: isSeries,
    onUpdate: (e) => {
      'worklet';
      scale.set(Math.max(0.6, Math.min(1, e.scale)));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.scale < 0.85 && onCompare) scheduleOnRN(onCompare);
      scale.set(withSpring(1, { damping: 16, stiffness: 200 }));
    },
  });

  const gesture = useSimultaneousGestures(pan, pinch);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { rotate: `${interpolate(x.get(), [-width, width], [-14, 14])}deg` },
      { scale: scale.get() },
    ],
  }));
  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, threshold], [0, 1], Extrapolation.CLAMP),
  }));
  const trashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [-threshold, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const favStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(y.get(), [-upThreshold, 0], [1, 0], Extrapolation.CLAMP) *
      interpolate(Math.abs(x.get()), [0, threshold], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, cardStyle]} testID="swipe-card">
        <Image
          source={{ uri: photo.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={120}
          recyclingKey={photo.id}
        />
        {photo.isVideo && <InlineVideo id={photo.id} />}

        <View style={styles.topRow} pointerEvents="none">
          <Chip text={formatDate(photo.creationTime)} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {photo.isScreenshot && <Chip text="Screenshot" tone={colors.accent} />}
            {photo.isVideo && <Chip text={`▶ ${formatDuration(photo.duration)}`} />}
          </View>
        </View>

        {isSeries && (
          <Pressable testID="compare" onPress={onCompare} style={styles.series}>
            <Text style={styles.seriesText}>
              Serie · {seriesCount} {seriesCount === 1 ? 'Foto' : 'Fotos'}
            </Text>
            <Text style={styles.seriesCta}>Vergleichen ⤡</Text>
          </Pressable>
        )}

        <Animated.View style={[styles.stamp, styles.stampKeep, keepStyle]} pointerEvents="none">
          <Text style={[styles.stampText, { color: colors.keep }]}>BEHALTEN</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampTrash, trashStyle]} pointerEvents="none">
          <Text style={[styles.stampText, { color: colors.trash }]}>WEG DAMIT</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampFav, favStyle]} pointerEvents="none">
          <Text style={[styles.stampText, { color: colors.fav }]}>★ FAVORIT</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Stumm in Schleife abspielendes Video über dem Vorschaubild. */
function InlineVideo({ id }: { id: string }) {
  const [uri, setUri] = useState<string>();
  useEffect(() => {
    let alive = true;
    getVideoUri(id).then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
  }, [id]);
  if (!uri) return null;
  return <VideoPlayerLayer uri={uri} />;
}

function VideoPlayerLayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

function Chip({ text, tone }: { text: string; tone?: string }) {
  return (
    <View style={[styles.chip, tone ? { backgroundColor: tone } : null]}>
      <Text style={[styles.chipText, tone ? { color: colors.accentInk } : null]}>{text}</Text>
    </View>
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
  next: { transform: [{ scale: 0.94 }, { translateY: 14 }], opacity: 0.55 },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chip: {
    backgroundColor: 'rgba(11,11,15,0.72)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  series: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(11,11,15,0.8)',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  seriesText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  seriesCta: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  stamp: {
    position: 'absolute',
    top: 60,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  stampKeep: { left: 22, borderColor: colors.keep, transform: [{ rotate: '-12deg' }] },
  stampTrash: { right: 22, borderColor: colors.trash, transform: [{ rotate: '12deg' }] },
  stampFav: { alignSelf: 'center', top: undefined, bottom: 90, borderColor: colors.fav },
  stampText: { fontSize: 26, fontWeight: '900', letterSpacing: 1.5 },
});
