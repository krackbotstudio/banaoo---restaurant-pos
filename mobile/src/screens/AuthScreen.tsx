import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { AppButton, AppCard, AppInput, AppTitle } from "../components/ui/primitives";
import { tokens } from "../theme/tokens";
import { PwaRouteScreen } from "./PwaRouteScreen";

export function AuthScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [staffLoginMode, setStaffLoginMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  if (staffLoginMode) {
    return <PwaRouteScreen routePath="/staff-login" title="Staff Login" onClose={() => setStaffLoginMode(false)} />;
  }

  const onSubmit = async () => {
    setLoading(true);
    setErrorText("");
    const result = isSignup
      ? await signUp(email.trim(), password, fullName.trim(), phone.trim())
      : await signIn(email.trim(), password);
    if (result.error) setErrorText(result.error.message);
    setLoading(false);
  };

  const onGoogle = async () => {
    setLoading(true);
    setErrorText("");
    const result = await signInWithGoogle();
    if (result.error) setErrorText(result.error.message);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <AppCard style={styles.card}>
        <Image source={require("../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
        <AppTitle style={styles.title}>Banaoo POS</AppTitle>
        <Text style={styles.subtitle}>Use the same account and data as your web POS.</Text>

        {isSignup && (
          <>
            <AppInput
              placeholder="Full Name"
              autoCapitalize="words"
              value={fullName}
              onChangeText={setFullName}
            />
            <AppInput
              placeholder="Phone"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </>
        )}

        <AppInput
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <AppInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

        <AppButton label={isSignup ? "Create Account" : "Sign In"} onPress={onSubmit} loading={loading} />

        <AppButton label="Continue with Google" onPress={onGoogle} disabled={loading} variant="outline" />

        <Pressable onPress={() => setIsSignup((prev) => !prev)}>
          <Text style={styles.switchText}>
            {isSignup ? "Already have an account? Sign In" : "No account yet? Create one"}
          </Text>
        </Pressable>
        <Pressable onPress={() => setStaffLoginMode(true)}>
          <Text style={styles.switchText}>Staff login</Text>
        </Pressable>
      </AppCard>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.mutedBackground,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  card: { borderRadius: 14, padding: 18, gap: 10 },
  logo: {
    width: 64,
    height: 64,
    alignSelf: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    color: tokens.colors.foreground,
  },
  subtitle: {
    color: tokens.colors.mutedForeground,
    marginBottom: 6,
  },
  switchText: {
    marginTop: 8,
    textAlign: "center",
    color: tokens.colors.secondaryForeground,
  },
  errorText: {
    color: tokens.colors.destructive,
    fontSize: 13,
  },
});
