import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiGetProfile, apiGetOperacoes } from "../services/api";

export default function HomeScreen({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [loadingPerfil, setLoadingPerfil] = useState(false);
  const [perfil, setPerfil] = useState(null);

  const [opsLoading, setOpsLoading] = useState(true);
  const [ops, setOps] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        setOpsLoading(true);
        const list = await apiGetOperacoes();
        setOps(Array.isArray(list) ? list : []);
      } catch (e) {
        Alert.alert("Erro", e.message || "Falha ao carregar operações");
        setOps([]);
      } finally {
        setOpsLoading(false);
      }
    })();
  }, []);

  function toggleMenu(){ setMenuOpen(v=>!v); }
  async function handlePerfil(){
    try{ setMenuOpen(false); setLoadingPerfil(true); setPerfilOpen(true);
      const p = await apiGetProfile(); setPerfil(p);
    }catch(e){ setPerfilOpen(false); Alert.alert("Erro", e.message || "Falha ao carregar perfil"); }
    finally{ setLoadingPerfil(false); }
  }
  function handleProducao(){ setMenuOpen(false); Alert.alert("Produção","Tela de Produção em construção."); }
  function handleSair(){ setMenuOpen(false); onLogout(); }
  function onPressOperacao(op){ Alert.alert("Operação", op); }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={toggleMenu} style={styles.menuBtn} hitSlop={10}>
          <Ionicons name="menu" size={26} color="#F9FAFB" />
        </Pressable>
      </View>

      {menuOpen && (
        <>
          <Pressable style={styles.overlay} onPress={()=>setMenuOpen(false)} />
          <View style={styles.dropdown}>
            <Pressable style={styles.menuItem} onPress={handlePerfil}>
              <Ionicons name="person-circle" size={18} color="#E5E7EB" />
              <Text style={styles.menuText}>Perfil</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleProducao}>
              <Ionicons name="construct" size={18} color="#E5E7EB" />
              <Text style={styles.menuText}>Produção</Text>
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={[styles.menuItem, styles.exit]} onPress={handleSair}>
              <Ionicons name="log-out" size={18} color="#FCA5A5" />
              <Text style={[styles.menuText, { color: "#FCA5A5" }]}>Sair</Text>
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.body}>
        {opsLoading ? (
          <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Carregando operações…</Text></View>
        ) : ops.length === 0 ? (
          <View style={styles.center}><Text style={styles.muted}>Sem operações atribuídas.</Text></View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContainer}>
            {ops.map(op => (
              <Pressable key={String(op)} style={styles.opBtn} onPress={()=>onPressOperacao(op)}>
                <Text style={styles.opTxt}>{op}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <Modal visible={perfilOpen} transparent animationType="fade" onRequestClose={()=>setPerfilOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={()=>setPerfilOpen(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Perfil</Text>
          {loadingPerfil ? (
            <View style={{ alignItems:"center", paddingVertical:12 }}><ActivityIndicator /><Text style={styles.modalLine}>Carregando…</Text></View>
          ) : perfil ? (
            <>
              <Text style={styles.modalLine}>ID: {perfil.id}</Text>
              <Text style={styles.modalLine}>Usuário: {perfil.username}</Text>
              <Text style={styles.modalLine}>Roles: {Array.isArray(perfil.roles) ? perfil.roles.join(", ") : String(perfil.roles || "")}</Text>
              <Text style={styles.modalLine}>Ativo: {perfil.is_active ? "sim" : "não"}</Text>
            </>
          ) : (<Text style={styles.modalLine}>Sem dados.</Text>)}
          <Pressable style={styles.closeBtn} onPress={()=>setPerfilOpen(false)}><Text style={styles.closeTxt}>Fechar</Text></Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{ flex:1, backgroundColor:"#0F172A" },
  header:{ height:56, flexDirection:"row", alignItems:"center", paddingHorizontal:12, borderBottomWidth:1, borderBottomColor:"#1F2937" },
  menuBtn:{ width:40, height:40, borderRadius:10, alignItems:"center", justifyContent:"center" },
  overlay:{ ...StyleSheet.absoluteFillObject, backgroundColor:"transparent" },
  dropdown:{ position:"absolute", top:56, left:8, width:180, backgroundColor:"#111827", borderWidth:1, borderColor:"#1F2937", borderRadius:12, paddingVertical:6, zIndex:10 },
  menuItem:{ flexDirection:"row", alignItems:"center", paddingVertical:10, paddingHorizontal:12, gap:8 },
  menuText:{ color:"#E5E7EB", fontSize:15 },
  divider:{ height:1, backgroundColor:"#1F2937", marginVertical:4 },
  exit:{},
  body:{ flex:1, padding:16 },
  center:{ flex:1, alignItems:"center", justifyContent:"center" },
  muted:{ color:"#9CA3AF" },
  listContainer:{ gap:10 },
  opBtn:{ backgroundColor:"#2563EB", borderRadius:12, paddingVertical:14, paddingHorizontal:16, borderWidth:1, borderColor:"#1E40AF" },
  opTxt:{ color:"#F9FAFB", fontWeight:"700", fontSize:16 },
  modalOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.45)" },
  modalCard:{ position:"absolute", left:20, right:20, top:"25%", backgroundColor:"#111827", borderWidth:1, borderColor:"#1F2937", borderRadius:16, padding:16 },
  modalTitle:{ color:"#F9FAFB", fontSize:18, fontWeight:"700", marginBottom:8 },
  modalLine:{ color:"#E5E7EB", marginTop:6 },
  closeBtn:{ marginTop:14, backgroundColor:"#374151", borderRadius:10, paddingVertical:10, alignItems:"center" },
  closeTxt:{ color:"#F9FAFB", fontWeight:"700" },
});