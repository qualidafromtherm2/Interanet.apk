import { Platform } from "react-native";
import { getToken } from "../lib/storage";

const LOCAL_BASE = Platform.OS === "web" ? "http://localhost:3001" : "http://192.168.1.16:3001";
const RENDER_URL = "https://interanet-apk.onrender.com";
const CANDIDATES = [RENDER_URL]; // só HTTPS no APK
const TIMEOUT_MS = 8000;


function fetchWithTimeout(url, options = {}, timeout = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function tryEndpoints(path, init) {
  let lastErr = "Conexão falhou";
  for (const base of CANDIDATES) {
    try {
      const res = await fetchWithTimeout(`${base}${path}`, init);
      const json = await res.json().catch(() => ({}));
      if (res.ok) return json;
      lastErr = json?.error || `HTTP ${res.status}`;
    } catch (e) {
      lastErr = e.name === "AbortError" ? "Tempo esgotado" : (e.message || String(e));
    }
  }
  throw new Error(lastErr);
}

export async function apiLogin(username, password) {
  return tryEndpoints("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function apiForgotPassword(identifier) {
  return tryEndpoints("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: identifier, username: identifier }),
  });
}

export async function apiGetProfile() {
  const token = await getToken();
  return tryEndpoints("/user/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiGetOperacoes() {
  const token = await getToken();
  return tryEndpoints("/user/operacoes", {
    headers: { Authorization: `Bearer ${token}` },
  });
}