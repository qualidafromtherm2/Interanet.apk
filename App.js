import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import { getToken, saveToken, clearToken } from "./src/lib/storage";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const t = await getToken();
        setToken(t);
      } catch (e) {
        console.warn("getToken falhou:", e?.message || e);
        setToken(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  async function handleLoggedIn(tok) { await saveToken(tok); setToken(tok); }
  async function handleLogout() { await clearToken(); setToken(null); }

  if (booting) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <ActivityIndicator />
        <Text style={styles.bootText}>Carregando…</Text>
      </View>
    );
  }
  if (!token) return <LoginScreen onLoggedIn={handleLoggedIn} />;
  return <HomeScreen onLogout={handleLogout} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  bootText: { color: "#E5E7EB", marginTop: 8 },
});