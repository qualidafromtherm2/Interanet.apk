import React, { useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { apiLogin } from "../services/api";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onLoggedIn }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [segura, setSegura] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const refSenha = useRef(null);

  const usuarioValido = useMemo(() => {
    const v = usuario.trim();
    if (v.length === 0) return false;
    return v.includes("@") ? emailRegex.test(v) : v.length >= 3;
  }, [usuario]);
  const senhaValida = senha.length >= 6;
  const podeEnviar = usuarioValido && senhaValida && !loading;

  async function submit(){
    setErro("");
    if(!usuarioValido) return setErro("Informe usuário ou e-mail válido.");
    if(!senhaValida) return setErro("Senha deve ter 6+ caracteres.");
    try{
      setLoading(true);
      const { token, user } = await apiLogin(usuario.trim(), senha);
      onLoggedIn(token, user);
    }catch(e){
      const msg = e.message || "Falha no login";
      setErro(msg); Alert.alert("Erro", msg);
    }finally{ setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.logo}><Ionicons name="lock-closed" size={28} color="#111827" /></View>
            <Text style={styles.title}>Entrar</Text>
            <Text style={styles.subtitle}>Acesse sua conta</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Usuário ou e-mail</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person" size={18} color="#6B7280" style={styles.leftIcon}/>
              <TextInput autoCapitalize="none" autoCorrect={false} placeholder="seu usuário ou e-mail" placeholderTextColor="#9CA3AF"
                value={usuario} onChangeText={setUsuario} style={styles.input}
                returnKeyType="next" onSubmitEditing={()=>refSenha.current?.focus()} blurOnSubmit={false}/>
              {usuario.length>0 && (
                <Ionicons name={usuarioValido ? "checkmark-circle" : "close-circle"} size={18} color={usuarioValido ? "#10B981" : "#EF4444"} style={styles.rightIcon}/>
              )}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputRow}>
              <Ionicons name="key" size={18} color="#6B7280" style={styles.leftIcon}/>
              <TextInput ref={refSenha} placeholder="••••••••" placeholderTextColor="#9CA3AF"
                value={senha} onChangeText={setSenha} secureTextEntry={segura} style={styles.input}
                returnKeyType="go" onSubmitEditing={submit}/>
              <Pressable onPress={()=>setSegura(s=>!s)} style={styles.rightIcon}>
                <Ionicons name={segura ? "eye-off" : "eye"} size={18} color="#6B7280" />
              </Pressable>
            </View>
          </View>

          {erro ? <Text style={styles.error}>{erro}</Text> : null}

          <Pressable onPress={submit} disabled={!podeEnviar}
            style={({pressed})=>[styles.button, !podeEnviar && styles.buttonDisabled, pressed && podeEnviar && styles.buttonPressed]}>
            {loading ? <ActivityIndicator/> : <Text style={styles.buttonText}>Entrar</Text>}
          </Pressable>

          <Text style={styles.hint}>* Use seu username do sistema e a senha.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe:{ flex:1, backgroundColor:"#0F172A" },
  wrap:{ flex:1, paddingHorizontal:20, alignItems:"center", justifyContent:"center" },
  card:{ width:"100%", maxWidth:420, backgroundColor:"#111827", borderRadius:16, padding:20, borderWidth:1, borderColor:"#1F2937" },
  header:{ alignItems:"center", marginBottom:18 },
  logo:{ width:52, height:52, borderRadius:12, backgroundColor:"#FBBF24", alignItems:"center", justifyContent:"center", marginBottom:8 },
  title:{ color:"#F9FAFB", fontSize:22, fontWeight:"700" },
  subtitle:{ color:"#9CA3AF", marginTop:4 },
  field:{ marginTop:12 },
  label:{ color:"#E5E7EB", marginBottom:6, fontSize:14 },
  inputRow:{ position:"relative", borderWidth:1, borderColor:"#374151", backgroundColor:"#0B1220", borderRadius:12, flexDirection:"row", alignItems:"center" },
  leftIcon:{ marginLeft:10 },
  rightIcon:{ paddingHorizontal:10, paddingVertical:8 },
  input:{ flex:1, color:"#F3F4F6", paddingVertical:12, paddingHorizontal:12 },
  error:{ color:"#FCA5A5", marginTop:8 },
  button:{ marginTop:16, height:48, borderRadius:12, backgroundColor:"#2563EB", alignItems:"center", justifyContent:"center" },
  buttonPressed:{ opacity:0.85 },
  buttonDisabled:{ backgroundColor:"#1E3A8A" },
  buttonText:{ color:"#F9FAFB", fontWeight:"700", fontSize:16 },
  hint:{ color:"#6B7280", textAlign:"center", marginTop:14, fontSize:12 },
});