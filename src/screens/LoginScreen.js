import React, { useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { apiLogin, apiForgotPassword, apiVerifyResetCode, apiResetPassword, apiCompleteRegistration } from "../services/api";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onLoggedIn }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [segura, setSegura] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const refSenha = useRef(null);

  const [resetStage, setResetStage] = useState(null); // null | 'request' | 'verify' | 'reset'
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");

  const [completeVisible, setCompleteVisible] = useState(false);
  const [completeUsername, setCompleteUsername] = useState("");
  const [completePassword, setCompletePassword] = useState("");
  const [completeNewPassword, setCompleteNewPassword] = useState("");
  const [completeEmail, setCompleteEmail] = useState("");

  // Removido Google Sign-In

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
      const result = await apiLogin(usuario.trim(), senha);
      if (result?.needsEmail) {
        setCompleteUsername(usuario.trim());
        setCompletePassword(senha);
        setCompleteNewPassword('');
        setCompleteEmail('');
        setCompleteVisible(true);
        Alert.alert('Completar cadastro', 'Informe o e-mail e defina uma nova senha para ativar seu acesso.');
        return;
      }
      const { token, user } = result || {};
      if (token && user) {
        onLoggedIn(token, user);
        return;
      }
      throw new Error('Resposta inesperada.');
    }catch(e){
      const msg = e.message || "Falha no login";
      setErro(msg); Alert.alert("Erro", msg);
    }finally{ setLoading(false); }
  }

  function openReset(stage){
    const identifier = usuario.trim() || resetIdentifier;
    setResetIdentifier(identifier);
    setResetStage(stage);
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
  }

  function closeReset(){
    setResetStage(null);
    setResetIdentifier('');
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setLoading(false);
  }

  async function handleSendResetCode(){
    const identifier = (resetIdentifier || '').trim();
    if(!identifier) { Alert.alert('Erro', 'Informe usuário ou e-mail.'); return; }
    try{
      setLoading(true);
      await apiForgotPassword(identifier);
      setResetStage('verify');
      Alert.alert('Solicitação enviada', 'Se o usuário existir, você receberá um código por e-mail.');
    }catch(e){
      Alert.alert('Erro', e.message || 'Falha ao solicitar código.');
    }finally{
      setLoading(false);
    }
  }

  async function handleValidateResetCode(){
    const identifier = (resetIdentifier || '').trim();
    const code = (resetCode || '').trim();
    if(!identifier) return Alert.alert('Erro', 'Informe usuário ou e-mail.');
    if(!/^[0-9]{6}$/.test(code)) return Alert.alert('Erro', 'Código deve ter 6 dígitos.');
    try{
      setLoading(true);
      await apiVerifyResetCode(identifier, code);
      setResetStage('reset');
      Alert.alert('Código válido', 'Informe a nova senha para concluir.');
    }catch(e){
      Alert.alert('Código inválido', e.message || 'Código inválido ou expirado.');
    }finally{
      setLoading(false);
    }
  }

  async function handleChangePassword(){
    const identifier = (resetIdentifier || '').trim();
    const code = (resetCode || '').trim();
    if(!identifier || !code){
      Alert.alert('Erro', 'Informe usuário/e-mail e código.');
      return;
    }
    if(resetNewPassword.length < 6) return Alert.alert('Erro', 'Nova senha deve ter 6+ caracteres.');
    if(resetNewPassword !== resetConfirmPassword) return Alert.alert('Erro', 'Senhas não conferem.');
    try{
      setLoading(true);
      await apiResetPassword(identifier, code, resetNewPassword);
      closeReset();
      Alert.alert('Senha alterada', 'Senha alterada com sucesso. Faça login com a nova senha.');
    }catch(e){
      Alert.alert('Erro', e.message || 'Falha ao alterar senha.');
    }finally{
      setLoading(false);
    }
  }

  async function handleCompleteRegistration(){
    const username = (completeUsername || '').trim();
    const currentPassword = completePassword;
    const newPassword = completeNewPassword;
    const email = (completeEmail || '').trim();

    if(!username || !currentPassword) return Alert.alert('Erro', 'Informe usuário e senha atual.');
    if(!emailRegex.test(email)) return Alert.alert('Erro', 'Informe um e-mail válido.');
    if(newPassword.length < 6) return Alert.alert('Erro', 'Nova senha deve ter 6+ caracteres.');
    if(newPassword === currentPassword) return Alert.alert('Erro', 'Use uma nova senha diferente da atual.');

    try{
      setLoading(true);
      await apiCompleteRegistration({ username, password: currentPassword, newPassword, email });
      setCompleteVisible(false);
      Alert.alert('Cadastro completo', 'Senha atualizada e e-mail cadastrado. Faça login novamente.');
    }catch(e){
      Alert.alert('Erro', e.message || 'Falha ao completar cadastro.');
    }finally{
      setLoading(false);
    }
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

          <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
            <Pressable onPress={() => openReset('request')} style={{padding:8}}>
              <Text style={{color:'#93C5FD', fontWeight:'600'}}>Esqueci a senha</Text>
            </Pressable>

            <Pressable onPress={() => openReset('verify')} style={{padding:8}}>
              <Text style={{color:'#93C5FD', fontWeight:'600'}}>Inserir código de verificação</Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>* Use seu username do sistema e a senha.</Text>
        </View>
      </KeyboardAvoidingView>
      {/* Modal fluxo de recuperação */}
      <Modal visible={Boolean(resetStage)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {resetStage === 'request' && (
              <>
                <Text style={{color:'#F9FAFB', fontWeight:'700', marginBottom:8}}>Enviar código de verificação</Text>
                <Text style={{color:'#9CA3AF', marginBottom:12}}>Informe seu usuário ou e-mail cadastrado. Enviaremos um código para redefinição.</Text>
                <TextInput autoCapitalize="none" autoCorrect={false} placeholder="usuário ou e-mail" placeholderTextColor="#9CA3AF"
                  value={resetIdentifier} onChangeText={setResetIdentifier} style={styles.modalInput} />
                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={closeReset} style={styles.modalButton}>
                    <Text style={styles.modalButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendResetCode} style={[styles.modalButton, {backgroundColor:'#2563EB'}]}>
                    {loading ? <ActivityIndicator color="#fff"/> : <Text style={[styles.modalButtonText, {color:'#fff'}]}>Enviar código</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {resetStage === 'verify' && (
              <>
                <Text style={{color:'#F9FAFB', fontWeight:'700', marginBottom:8}}>Validar código</Text>
                <Text style={{color:'#9CA3AF', marginBottom:12}}>Informe o usuário/e-mail e o código recebido.</Text>
                <TextInput autoCapitalize="none" autoCorrect={false} placeholder="usuário ou e-mail" placeholderTextColor="#9CA3AF"
                  value={resetIdentifier} onChangeText={setResetIdentifier} style={styles.modalInput} />
                <TextInput placeholder="código de 6 dígitos" placeholderTextColor="#9CA3AF"
                  value={resetCode} onChangeText={setResetCode} style={styles.modalInput} keyboardType="numeric" maxLength={6} />
                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={closeReset} style={styles.modalButton}>
                    <Text style={styles.modalButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleValidateResetCode} style={[styles.modalButton, {backgroundColor:'#2563EB'}]}>
                    {loading ? <ActivityIndicator color="#fff"/> : <Text style={[styles.modalButtonText, {color:'#fff'}]}>Validar código</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {resetStage === 'reset' && (
              <>
                <Text style={{color:'#F9FAFB', fontWeight:'700', marginBottom:8}}>Definir nova senha</Text>
                <Text style={{color:'#9CA3AF', marginBottom:12}}>Digite a nova senha para concluir a recuperação.</Text>
                <TextInput autoCapitalize="none" autoCorrect={false} placeholder="usuário ou e-mail" placeholderTextColor="#9CA3AF"
                  value={resetIdentifier} onChangeText={setResetIdentifier} style={styles.modalInput} />
                <TextInput placeholder="código de 6 dígitos" placeholderTextColor="#9CA3AF"
                  value={resetCode} onChangeText={setResetCode} style={styles.modalInput} keyboardType="numeric" maxLength={6} />
                <TextInput placeholder="nova senha" placeholderTextColor="#9CA3AF"
                  value={resetNewPassword} onChangeText={setResetNewPassword} secureTextEntry style={styles.modalInput} />
                <TextInput placeholder="repita a nova senha" placeholderTextColor="#9CA3AF"
                  value={resetConfirmPassword} onChangeText={setResetConfirmPassword} secureTextEntry style={styles.modalInput} />
                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={closeReset} style={styles.modalButton}>
                    <Text style={styles.modalButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleChangePassword} style={[styles.modalButton, {backgroundColor:'#2563EB'}]}>
                    {loading ? <ActivityIndicator color="#fff"/> : <Text style={[styles.modalButtonText, {color:'#fff'}]}>Alterar senha</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal completar cadastro (usuário sem e-mail) */}
      <Modal visible={completeVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={{color:'#F9FAFB', fontWeight:'700', marginBottom:8}}>Completar cadastro</Text>
            <Text style={{color:'#9CA3AF', marginBottom:12}}>Informe os dados para finalizar o cadastro.</Text>
            <TextInput autoCapitalize="none" autoCorrect={false} placeholder="usuário" placeholderTextColor="#9CA3AF"
              value={completeUsername} onChangeText={setCompleteUsername} style={styles.modalInput} />
            <TextInput placeholder="senha atual" placeholderTextColor="#9CA3AF" secureTextEntry
              value={completePassword} onChangeText={setCompletePassword} style={styles.modalInput} />
            <TextInput placeholder="nova senha" placeholderTextColor="#9CA3AF" secureTextEntry
              value={completeNewPassword} onChangeText={setCompleteNewPassword} style={styles.modalInput} />
            <TextInput placeholder="e-mail" placeholderTextColor="#9CA3AF" keyboardType="email-address"
              autoCapitalize="none" value={completeEmail} onChangeText={setCompleteEmail} style={styles.modalInput} />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={()=>{ setCompleteVisible(false); setCompletePassword(''); setCompleteNewPassword(''); setCompleteEmail(''); }} style={styles.modalButton}>
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCompleteRegistration} style={[styles.modalButton, {backgroundColor:'#2563EB'}]}>
                {loading ? <ActivityIndicator color="#fff"/> : <Text style={[styles.modalButtonText, {color:'#fff'}]}>Salvar</Text>}
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