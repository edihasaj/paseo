import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

// `resolveComposerToolbarGlyphSize` returns `ICON_SIZE.sm` (14) on every
// platform, so one fixed envelope replaces the old per-platform branch.
export function ComposerToolbarGlyph({ children }: { children: ReactNode; size?: number }) {
  return (
    <View
      style={styles.envelope}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  envelope: {
    width: 16,
    height: 16,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
