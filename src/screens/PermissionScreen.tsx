import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import { colors } from '../theme';

type Props = { canAskAgain: boolean; onRequest: () => void };

export function PermissionScreen({ canAskAgain, onRequest }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={{ gap: 14 }}>
        <Text style={styles.title}>Rewind</Text>
        <Text style={styles.text}>
          Spul deine Galerie Monat für Monat zurück: nach links wischen zum Aussortieren, nach rechts zum Behalten, nach
          oben für Favoriten – und am Ende alles Aussortierte auf einmal löschen.
        </Text>
        <Text style={styles.text}>
          Dafür braucht Rewind Zugriff auf deine Fotos und Videos. Alles bleibt auf deinem Handy – es gibt keinen Server und
          keinen Upload.
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        {canAskAgain ? (
          <Button testID="grant-access" label="Zugriff auf Fotos erlauben" onPress={onRequest} />
        ) : (
          <>
            <Text style={styles.hint}>
              Der Zugriff wurde abgelehnt. Du kannst ihn in den Einstellungen unter „Fotos“ wieder erlauben.
            </Text>
            <Button label="Einstellungen öffnen" onPress={() => Linking.openSettings()} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24, justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 38, fontWeight: '800', letterSpacing: -0.5 },
  text: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  hint: { color: colors.warn, fontSize: 15, lineHeight: 21 },
});
