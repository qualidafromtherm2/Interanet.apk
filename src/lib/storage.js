import { Platform } from "react-native";
const KEY="auth_token"; const isWeb = Platform.OS === "web";
export async function saveToken(t){ if(isWeb){ try{ localStorage.setItem(KEY,t);}catch{} return; } const SecureStore = await import("expo-secure-store"); await SecureStore.setItemAsync(KEY,t); }
export async function getToken(){ if(isWeb){ try{ return localStorage.getItem(KEY)||null;}catch{ return null; } } const SecureStore = await import("expo-secure-store"); return await SecureStore.getItemAsync(KEY); }
export async function clearToken(){ if(isWeb){ try{ localStorage.removeItem(KEY);}catch{} return; } const SecureStore = await import("expo-secure-store"); await SecureStore.deleteItemAsync(KEY); }