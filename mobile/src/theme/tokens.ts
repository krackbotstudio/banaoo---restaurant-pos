export const tokens = {
  colors: {
    background: "#FFF8F0",
    foreground: "#121212",
    mutedBackground: "#F8F0D0",
    mutedForeground: "#6B5344",
    card: "#ffffff",
    cardForeground: "#121212",
    border: "#E8D5C4",
    input: "#D9C4B0",
    primary: "#FF4500",
    primaryForeground: "#ffffff",
    secondary: "#FFF1E6",
    secondaryForeground: "#121212",
    destructive: "#E80808",
    destructiveForeground: "#ffffff",
    success: "#16a34a",
    successForeground: "#ffffff",
    warningBackground: "#FFF4E0",
    warningForeground: "#9A5B00",
    accent: "#F89800",
  },
  radius: {
    sm: 8,
    md: 10,
    lg: 12,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  typography: {
    fontFamily: "System",
    title: 24,
    heading: 18,
    body: 14,
    caption: 12,
  },
  shadows: {
    card: {
      shadowColor: "#0f172a",
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
  },
} as const;

export type AppTokens = typeof tokens;
