import Svg, { Path } from "react-native-svg";
import { withUnistyles } from "react-native-unistyles";
import type { Theme } from "@/styles/theme";

interface StrollLogoProps {
  size?: number;
  color?: string;
}

// react-native-svg takes the colour as a plain prop rather than a style, so the
// theme-reactive default goes through withUnistyles (docs/unistyles.md #3).
const ThemedPath = withUnistyles(Path, (theme: Theme) => ({
  stroke: theme.colors.foreground,
}));

/**
 * The Stroll mark: one continuous winding path, drawn as a single unbroken
 * stroke. Keep the geometry in step with the icon art in
 * `packages/desktop/assets`.
 */
const MARK = "M 350 566 C 169.5 507.2, 169.5 404.7, 350 350 C 530.5 295.3, 530.5 192.8, 350 134";

export function StrollLogo({ size = 64, color }: StrollLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 700 700" fill="none">
      {color ? (
        <Path
          d={MARK}
          fill="none"
          stroke={color}
          strokeWidth={67}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <ThemedPath
          d={MARK}
          fill="none"
          strokeWidth={67}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}
