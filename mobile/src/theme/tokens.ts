export const tokens = {
  colors: {
    background: "#ffffff",
    foreground: "#0f172a",
    mutedBackground: "#f8fafc",
    mutedForeground: "#64748b",
    card: "#ffffff",
    cardForeground: "#0f172a",
    border: "#e2e8f0",
    input: "#cbd5e1",
    primary: "#f97316",
    primaryForeground: "#ffffff",
    secondary: "#f1f5f9",
    secondaryForeground: "#0f172a",
    destructive: "#ef4444",
    destructiveForeground: "#ffffff",
    success: "#16a34a",
    successForeground: "#ffffff",
    warningBackground: "#fff7ed",
    warningForeground: "#c2410c",
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
