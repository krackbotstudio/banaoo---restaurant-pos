import React from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { tokens } from "../../theme/tokens";

export function AppCard({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style as StyleProp<ViewStyle>]} />;
}

type ButtonVariant = "primary" | "secondary" | "outline" | "destructive" | "success";

interface AppButtonProps extends PressableProps {
  label: string;
  loading?: boolean;
  variant?: ButtonVariant;
  labelStyle?: StyleProp<TextStyle>;
}

export function AppButton({
  label,
  loading,
  variant = "primary",
  disabled,
  style,
  labelStyle,
  ...props
}: AppButtonProps) {
  const buttonStyles = [
    styles.buttonBase,
    variant === "primary" && styles.buttonPrimary,
    variant === "secondary" && styles.buttonSecondary,
    variant === "outline" && styles.buttonOutline,
    variant === "destructive" && styles.buttonDestructive,
    variant === "success" && styles.buttonSuccess,
    (disabled || loading) && styles.buttonDisabled,
    style as StyleProp<ViewStyle>,
  ];

  const textStyles = [
    styles.buttonLabel,
    (variant === "secondary" || variant === "outline") && styles.buttonLabelDark,
    variant === "outline" && styles.buttonLabelOutline,
    labelStyle,
  ];

  return (
    <Pressable {...props} disabled={disabled || loading} style={buttonStyles}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={textStyles}>{label}</Text>}
    </Pressable>
  );
}

export function AppInput({ style, ...props }: TextInputProps) {
  return <TextInput {...props} style={[styles.input, style]} placeholderTextColor={tokens.colors.mutedForeground} />;
}

export function AppTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function AppBody({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.card,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
    ...tokens.shadows.card,
  },
  buttonBase: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: tokens.colors.secondary,
    borderColor: tokens.colors.secondary,
  },
  buttonOutline: {
    backgroundColor: tokens.colors.background,
    borderColor: tokens.colors.border,
  },
  buttonDestructive: {
    backgroundColor: tokens.colors.destructive,
    borderColor: tokens.colors.destructive,
  },
  buttonSuccess: {
    backgroundColor: tokens.colors.success,
    borderColor: tokens.colors.success,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: tokens.colors.primaryForeground,
    fontWeight: "700",
    fontFamily: tokens.typography.fontFamily,
  },
  buttonLabelDark: {
    color: tokens.colors.secondaryForeground,
  },
  buttonLabelOutline: {
    color: tokens.colors.foreground,
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.input,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: tokens.colors.foreground,
    fontFamily: tokens.typography.fontFamily,
  },
  title: {
    fontSize: tokens.typography.title,
    fontWeight: "700",
    color: tokens.colors.foreground,
    fontFamily: tokens.typography.fontFamily,
  },
  body: {
    color: tokens.colors.mutedForeground,
    lineHeight: 20,
    fontFamily: tokens.typography.fontFamily,
  },
});
