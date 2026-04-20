import React from "react";
import { ScrollView, ScrollViewProps, StyleSheet, View, ViewProps } from "react-native";
import { tokens } from "../../theme/tokens";

interface ScreenProps extends ViewProps {
  padded?: boolean;
}

export function AppScreen({ style, padded = true, ...props }: ScreenProps) {
  return <View {...props} style={[styles.base, padded && styles.padded, style]} />;
}

export function AppScrollScreen({ style, contentContainerStyle, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      {...props}
      style={[styles.base, style]}
      contentContainerStyle={[styles.padded, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: tokens.colors.mutedBackground,
  },
  padded: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
});
