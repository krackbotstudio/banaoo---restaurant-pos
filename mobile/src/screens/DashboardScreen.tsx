import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useOutlet } from "../context/OutletContext";
import { AppCard, AppTitle } from "../components/ui/primitives";
import { tokens } from "../theme/tokens";

export function DashboardScreen() {
  const { profile } = useAuth();
  const { outlets, currentOutlet, setCurrentOutlet, canSwitchOutlets } = useOutlet();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppTitle>Dashboard</AppTitle>
      <Text style={styles.subheading}>
        Logged in as {profile?.full_name || profile?.role || "user"}.
      </Text>

      <AppCard>
        <Text style={styles.cardTitle}>Current Outlet</Text>
        <Text style={styles.cardValue}>{currentOutlet?.name || "No outlet assigned"}</Text>
        {!!currentOutlet?.gst_number && (
          <Text style={styles.meta}>GSTIN: {currentOutlet.gst_number}</Text>
        )}
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Switch Outlet</Text>
        {!canSwitchOutlets && (
          <Text style={styles.meta}>Your role cannot switch outlets.</Text>
        )}
        {outlets.map((outlet) => {
          const selected = outlet.id === currentOutlet?.id;
          return (
            <Pressable
              key={outlet.id}
              style={[styles.outletBtn, selected && styles.outletBtnSelected]}
              onPress={() => setCurrentOutlet(outlet)}
              disabled={!canSwitchOutlets}
            >
              <Text style={[styles.outletText, selected && styles.outletTextSelected]}>
                {outlet.name}
              </Text>
            </Pressable>
          );
        })}
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.mutedBackground },
  content: { padding: 16, gap: 14 },
  subheading: { color: tokens.colors.mutedForeground },
  cardTitle: { fontWeight: "700", color: tokens.colors.foreground },
  cardValue: { fontSize: 16, color: tokens.colors.secondaryForeground },
  meta: { color: tokens.colors.mutedForeground, fontSize: 13 },
  outletBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.input,
    backgroundColor: tokens.colors.background,
  },
  outletBtnSelected: {
    borderColor: tokens.colors.primary,
    backgroundColor: tokens.colors.warningBackground,
  },
  outletText: { color: tokens.colors.secondaryForeground },
  outletTextSelected: { color: tokens.colors.warningForeground, fontWeight: "700" },
});
