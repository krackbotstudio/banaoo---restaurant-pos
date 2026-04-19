import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useOutlet } from "../context/OutletContext";

export function DashboardScreen() {
  const { profile } = useAuth();
  const { outlets, currentOutlet, setCurrentOutlet, canSwitchOutlets } = useOutlet();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Dashboard</Text>
      <Text style={styles.subheading}>
        Logged in as {profile?.full_name || profile?.role || "user"}.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Outlet</Text>
        <Text style={styles.cardValue}>{currentOutlet?.name || "No outlet assigned"}</Text>
        {!!currentOutlet?.gst_number && (
          <Text style={styles.meta}>GSTIN: {currentOutlet.gst_number}</Text>
        )}
      </View>

      <View style={styles.card}>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 14 },
  heading: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  subheading: { color: "#64748b" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 8,
  },
  cardTitle: { fontWeight: "700", color: "#0f172a" },
  cardValue: { fontSize: 16, color: "#1e293b" },
  meta: { color: "#64748b", fontSize: 13 },
  outletBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  outletBtnSelected: {
    borderColor: "#f97316",
    backgroundColor: "#fff7ed",
  },
  outletText: { color: "#334155" },
  outletTextSelected: { color: "#c2410c", fontWeight: "700" },
});
