import React from "react";
import { DefaultTheme, NavigationContainer, Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NativePrinterScreen } from "../screens/NativePrinterScreen";
import { PwaShellScreen } from "../screens/PwaShellScreen";
import { tokens } from "../theme/tokens";

const Stack = createNativeStackNavigator();

const navigationLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: tokens.colors.primary,
    background: tokens.colors.background,
    card: tokens.colors.background,
    text: tokens.colors.foreground,
    border: tokens.colors.border,
    notification: tokens.colors.primary,
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer theme={navigationLightTheme}>
      <Stack.Navigator>
        <Stack.Screen
          name="PwaShell"
          options={{ headerShown: false }}
        >
          {({ navigation }) => (
            <PwaShellScreen onOpenPrinters={() => navigation.navigate("NativePrinters")} />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="NativePrinters"
          component={NativePrinterScreen}
          options={{
            title: "Native printer settings",
            presentation: "modal",
            headerShown: true,
            headerShadowVisible: true,
            contentStyle: { backgroundColor: tokens.colors.background },
            headerStyle: {
              backgroundColor: tokens.colors.background,
            },
            headerTintColor: tokens.colors.foreground,
            headerTitleStyle: {
              color: tokens.colors.foreground,
              fontWeight: "600",
              fontSize: 17,
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
