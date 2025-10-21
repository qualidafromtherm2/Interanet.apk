import React, { useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { apiLogin, apiForgotPassword, apiVerifyResetCode, apiResetPassword } from "../services/api";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onLoggedIn }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [isResetFlow, setIsResetFlow] = useState(false);
  const [newSenha, setNewSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [segura, setSegura] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const refSenha = useRef(null);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotInput, setForgotInput] = useState("");

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
    // Se estamos no fluxo de reset (já verificado código), então trocar senha
    if(isResetFlow){
      if(newSenha.length < 6) return setErro('Nova senha deve ter 6+ caracteres.');
      if(newSenha !== confirmSenha) return setErro('Senhas não conferem.');
      try{
        setLoading(true);
        await apiResetPassword(usuario.trim(), senha.trim(), newSenha);
        Alert.alert('Sucesso', 'Senha redefinida. Use a nova senha para entrar.');
        // resetar estados e focar login
        setIsResetFlow(false); setNewSenha(''); setConfirmSenha(''); setSenha('');
      }catch(e){ Alert.alert('Erro', e.message || 'Falha ao resetar senha'); }
      finally{ setLoading(false); }
      return;
    }
    // fluxo normal de login
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

  // Função para verificar se o campo senha contém um código de 6 dígitos e iniciar verificação
  async function tryVerifyCode(val){
    const code = (val || '').trim();
    if(!/^[0-9]{6}$/.test(code)) return; // não é código
    if(!usuarioValido) { Alert.alert('Erro', 'Informe usuário válido antes do código.'); return; }
    try{
      setLoading(true);
      await apiVerifyResetCode(usuario.trim(), code);
      // código válido -> entrar no fluxo de reset: senha atual passa a ser o código e exibimos campos de nova senha
      setIsResetFlow(true);
      Alert.alert('Código válido', 'Digite a nova senha e confirme para concluir.');
    }catch(e){ Alert.alert('Código inválido', e.message || 'Código inválido ou expirado.'); }
    finally{ setLoading(false); }
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
              {!isResetFlow ? (
                <TextInput ref={refSenha} placeholder="••••••••" placeholderTextColor="#9CA3AF"
                  value={senha} onChangeText={(v)=>{ setSenha(v); tryVerifyCode(v); }} secureTextEntry={segura} style={styles.input}
                  returnKeyType="go" onSubmitEditing={submit}/>
              ) : (
                <TextInput placeholder="Código recebido (usado)" placeholderTextColor="#9CA3AF"
                  value={senha} editable={false} style={styles.input} />
              )}
              <Pressable onPress={()=>setSegura(s=>!s)} style={styles.rightIcon}>
                <Ionicons name={segura ? "eye-off" : "eye"} size={18} color="#6B7280" />
              </Pressable>
            </View>
          </View>

          {isResetFlow && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Nova senha</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="key" size={18} color="#6B7280" style={styles.leftIcon}/>
                  <TextInput placeholder="Nova senha" placeholderTextColor="#9CA3AF"
                    value={newSenha} onChangeText={setNewSenha} secureTextEntry style={styles.input} />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Repetir nova senha</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="key" size={18} color="#6B7280" style={styles.leftIcon}/>
                  <TextInput placeholder="Repita a nova senha" placeholderTextColor="#9CA3AF"
                    value={confirmSenha} onChangeText={setConfirmSenha} secureTextEntry style={styles.input} />
                </View>
              </View>
            </>
          )}

          {erro ? <Text style={styles.error}>{erro}</Text> : null}

          <Pressable onPress={submit} disabled={!podeEnviar}
            style={({pressed})=>[styles.button, !podeEnviar && styles.buttonDisabled, pressed && podeEnviar && styles.buttonPressed]}>
            {loading ? <ActivityIndicator/> : <Text style={styles.buttonText}>Entrar</Text>}
          </Pressable>

          <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
            <Pressable onPress={async ()=>{
                // web: usar prompt nativo quando disponível
                if (Platform.OS === 'web' && typeof window !== 'undefined' && window.prompt) {
                  const val = window.prompt('Informe seu e-mail ou usuário para redefinir a senha:');
                  if (!val) return;
                  try{ setLoading(true); await apiForgotPassword(val.trim()); Alert.alert('Solicitação enviada', 'Se o e-mail/usuário existir, você receberá instruções por e-mail.'); }
                  catch(e){ Alert.alert('Erro', e.message || 'Falha ao enviar solicitação'); }
                  finally{ setLoading(false); }
                  return;
                }
                // mobile: abrir modal para digitar
                setForgotInput(usuario || '');
                setForgotVisible(true);
              }} style={{padding:8}}>
              <Text style={{color:'#93C5FD', fontWeight:'600'}}>Esqueci a senha</Text>
            </Pressable>

            <Pressable onPress={()=>{
                // botão criado sem funcionalidade por enquanto
                Alert.alert('Solicitação de cadastro', 'Funcionalidade não implementada ainda.');
              }} style={{padding:8}}>
              <Text style={{color:'#93C5FD', fontWeight:'600'}}>Solicitação de cadastro</Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>* Use seu username do sistema e a senha.</Text>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={forgotVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={{color:'#F9FAFB', fontWeight:'700', marginBottom:8}}>Redefinir senha</Text>
            <Text style={{color:'#9CA3AF', marginBottom:12}}>Informe seu e-mail ou usuário</Text>
            <TextInput autoCapitalize="none" autoCorrect={false} placeholder="usuário ou e-mail" placeholderTextColor="#9CA3AF"
              value={forgotInput} onChangeText={setForgotInput} style={styles.modalInput} />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={()=>{ setForgotVisible(false); setForgotInput(''); }} style={styles.modalButton}>
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async ()=>{
                  const val = (forgotInput||'').trim();
                  if (!val) return Alert.alert('Erro', 'Informe um e-mail ou usuário.');
                  try{ setLoading(true); await apiForgotPassword(val); setForgotVisible(false); setForgotInput(''); Alert.alert('Solicitação enviada', 'Se o e-mail/usuário existir, você receberá instruções por e-mail.'); }
                  catch(e){ Alert.alert('Erro', e.message || 'Falha ao enviar solicitação'); }
                  finally{ setLoading(false); }
                }} style={[styles.modalButton, {backgroundColor:'#2563EB'}]}>
                {loading ? <ActivityIndicator color="#fff"/> : <Text style={[styles.modalButtonText, {color:'#fff'}]}>Enviar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalBackdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center' },
  modalCard:{ width:'90%', maxWidth:420, backgroundColor:'#0B1220', borderRadius:12, padding:16, borderWidth:1, borderColor:'#1F2937' },
  modalInput:{ borderWidth:1, borderColor:'#374151', backgroundColor:'#07101A', color:'#F3F4F6', padding:10, borderRadius:8, marginBottom:12 },
  modalButtons:{ flexDirection:'row', justifyContent:'flex-end', gap:8 },
  modalButton:{ paddingVertical:10, paddingHorizontal:12, borderRadius:8 },
  modalButtonText:{ color:'#93C5FD', fontWeight:'600' },
});