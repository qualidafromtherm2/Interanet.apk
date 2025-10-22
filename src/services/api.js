export async function apiLoginGoogle(id_token) {
  return tryEndpoints('/auth/google-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token }),
  });
}
import { Platform } from "react-native";
import { getToken } from "../lib/storage";

const LOCAL_BASE = Platform.OS === "web" ? "http://localhost:3001" : "http://192.168.1.16:3001";
const RENDER_URL = "https://interanet-apk.onrender.com";
const CANDIDATES = [LOCAL_BASE, RENDER_URL]; // tenta local primeiro, depois produção
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
      console.log(`[tryEndpoints] tentando ${base}${path}`);
      const res = await fetchWithTimeout(`${base}${path}`, init);
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`[tryEndpoints] sucesso em ${base}${path}`);
        return json;
      }
      const err = new Error(json?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = json;
      throw err;
    } catch (e) {
      if (e?.status) throw e;
      console.warn(`[tryEndpoints] falha em ${base}${path}:`, e?.message || e);
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

export async function apiVerifyResetCode(username, code) {
  return tryEndpoints('/auth/verify-reset-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, code }),
  });
}

export async function apiResetPassword(username, code, newPassword) {
  return tryEndpoints('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, code, newPassword }),
  });
}

export async function apiCompleteRegistration(payload) {
  return tryEndpoints('/auth/complete-registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

export async function apiBuscarCodigo(term, limit) {
  const token = await getToken();
  const query = [];
  query.push(`term=${encodeURIComponent(term ?? "")}`);
  if (limit) query.push(`limit=${encodeURIComponent(String(limit))}`);
  const path = `/user/busca-codigo?${query.join("&")}`;
  console.log("[apiBuscarCodigo] ▶️ buscando", { term, limit, path });
  const data = await tryEndpoints(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("[apiBuscarCodigo] ✅ retorno", data);
  return data;
}

export async function apiListaPecas(ordem) {
  const token = await getToken();
  const codigo = encodeURIComponent(ordem ?? "");
  const path = `/user/lista-pecas?ordem=${codigo}`;
  console.log("[apiListaPecas] ▶️ buscando peças", { ordem, path });
  const data = await tryEndpoints(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("[apiListaPecas] ✅ retorno", data);
  return data;
}