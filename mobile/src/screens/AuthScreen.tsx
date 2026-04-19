import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const onSubmit = async () => {
    setLoading(true);
    setErrorText("");
    const result = isSignup
      ? await signUp(email.trim(), password, fullName.trim(), phone.trim())
      : await signIn(email.trim(), password);
    if (result.error) setErrorText(result.error.message);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Banaoo POS Mobile</Text>
        <Text style={styles.subtitle}>Use the same account and data as your web POS.</Text>

        {isSignup && (
          <>
            <TextInput
              placeholder="Full Name"
              style={styles.input}
              autoCapitalize="words"
              value={fullName}
              onChangeText={setFullName}
            />
            <TextInput
              placeholder="Phone"
              style={styles.input}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </>
        )}

        <TextInput
          placeholder="Email"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          placeholder="Password"
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

        <Pressable style={styles.submitButton} onPress={onSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{isSignup ? "Create Account" : "Sign In"}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => setIsSignup((prev) => !prev)}>
          <Text style={styles.switchText}>
            {isSignup ? "Already have an account? Sign In" : "No account yet? Create one"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    color: "#64748b",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  submitButton: {
    marginTop: 8,
    backgroundColor: "#f97316",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  switchText: {
    marginTop: 8,
    textAlign: "center",
    color: "#334155",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
  },
});
