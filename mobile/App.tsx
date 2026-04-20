import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { OutletProvider } from "./src/context/OutletContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OutletProvider>
          <StatusBar style="dark" translucent={false} backgroundColor="#ffffff" />
          <AppNavigator />
        </OutletProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
