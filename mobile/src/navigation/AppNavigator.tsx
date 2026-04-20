import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NativePrinterScreen } from "../screens/NativePrinterScreen";
import { PwaShellScreen } from "../screens/PwaShellScreen";

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <NavigationContainer>
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
            title: "Printers",
            presentation: "modal",
            headerShown: true,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
