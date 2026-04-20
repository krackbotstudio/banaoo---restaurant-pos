import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScrollScreen } from "../components/ui/AppScreen";
import { AppCard, AppTitle } from "../components/ui/primitives";
import { tokens } from "../theme/tokens";
import { useStaffPermissions } from "../lib/use-staff-permissions";
import { useAuth } from "../context/AuthContext";

export type MoreRouteName =
  | "Outlets"
  | "Menu"
  | "Staff"
  | "Integrations"
  | "OrderHistory"
  | "Customers"
  | "Analytics";

const MODULES: Array<{ route: MoreRouteName; label: string; permission: string }> = [
  { route: "Outlets", label: "Outlets", permission: "outlets" },
  { route: "Menu", label: "Menu", permission: "menu" },
  { route: "Staff", label: "Staff", permission: "staff" },
  { route: "Integrations", label: "Integrations", permission: "integrations" },
  { route: "OrderHistory", label: "Order History", permission: "order-history" },
  { route: "Customers", label: "Customers", permission: "customers" },
  { route: "Analytics", label: "Analytics", permission: "analytics" },
];

export function MoreModulesScreen({
  navigation,
}: {
  navigation: any;
}) {
  const { profile } = useAuth();
  const { permissions } = useStaffPermissions();
  const visibleModules =
    profile?.role === "owner" || !permissions
      ? MODULES
      : MODULES.filter((module) => permissions.includes(module.permission));

  return (
    <AppScrollScreen>
      <AppTitle>More Modules</AppTitle>
      <AppCard>
        <Text style={styles.helpText}>Open additional modules mirrored from the PWA mobile experience.</Text>
        <View style={styles.grid}>
          {visibleModules.map((module) => (
            <Pressable key={module.route} style={styles.moduleCard} onPress={() => navigation.navigate(module.route)}>
              <Text style={styles.moduleText}>{module.label}</Text>
            </Pressable>
          ))}
        </View>
      </AppCard>
    </AppScrollScreen>
  );
}

const styles = StyleSheet.create({
  helpText: {
    color: tokens.colors.mutedForeground,
    marginBottom: tokens.spacing.md,
  },
  grid: {
    gap: tokens.spacing.sm,
  },
  moduleCard: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: tokens.colors.background,
  },
  moduleText: {
    color: tokens.colors.foreground,
    fontWeight: "600",
  },
});
