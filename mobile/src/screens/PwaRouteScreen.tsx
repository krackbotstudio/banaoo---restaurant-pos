import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { WEBAPP_URL } from "../lib/config";
import { tokens } from "../theme/tokens";

interface PwaRouteScreenProps {
  routePath: string;
  title: string;
  onClose?: () => void;
}

function buildRouteUrl(routePath: string) {
  const trimmedBase = WEBAPP_URL.replace(/\/+$/, "");
  const normalizedPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${trimmedBase}${normalizedPath}`;
}

export function PwaRouteScreen({ routePath, title, onClose }: PwaRouteScreenProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const url = useMemo(() => buildRouteUrl(routePath), [routePath]);

  if (!WEBAPP_URL) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>Set EXPO_PUBLIC_WEBAPP_URL in mobile/.env to render PWA parity screens.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onClose ? (
            <Pressable style={styles.refreshBtn} onPress={onClose}>
              <Text style={styles.refreshText}>Back</Text>
            </Pressable>
          ) : null}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => setReloadKey((prev) => prev + 1)}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading {title}...</Text>
        </View>
      ) : null}
      <WebView
        key={`${routePath}-${reloadKey}`}
        source={{ uri: url }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: tokens.colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
  },
  refreshText: {
    color: tokens.colors.foreground,
    fontWeight: "600",
  },
  loadingOverlay: {
    position: "absolute",
    zIndex: 10,
    top: 54,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: tokens.colors.warningBackground,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: tokens.colors.warningForeground,
    fontWeight: "600",
  },
  webview: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  fallback: {
    flex: 1,
    backgroundColor: tokens.colors.mutedBackground,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
  },
  title: {
    fontSize: tokens.typography.heading,
    fontWeight: "700",
    color: tokens.colors.foreground,
  },
  text: {
    color: tokens.colors.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  },
});
