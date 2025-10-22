import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator, Alert, ScrollView, TextInput, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiGetProfile, apiGetOperacoes, apiBuscarCodigo } from "../services/api";

const TABLE_LABELS = {
  historico_op_glide: "Histórico OP Glide",
  historico_op_glide_f_escopo: "Histórico OP Glide F Escopo",
  historico_pedido_originalis: "Histórico Pedido Originalis",
};

const COLUMN_LABELS = {
  pedido: "Pedido",
  ordem_de_producao: "Ordem de Produção",
  nota_fiscal: "Nota Fiscal",
};

const TABLE_FIELDS = {
  historico_op_glide: [
    { key: "controlador", label: "Controlador" },
    { key: "modelo", label: "Modelo" },
    { key: "ordem_de_producao", label: "Ordem de Produção" },
    { key: "pedido", label: "Pedido" },
    { key: "primeiro_teste_tipo_de_gas", label: "1º Teste (Tipo de Gás)" },
  ],
  historico_op_glide_f_escopo: [
    { key: "controlador", label: "Controlador" },
    { key: "modelo", label: "Modelo" },
    { key: "ordem_de_producao", label: "Ordem de Produção" },
    { key: "pedido", label: "Pedido" },
    { key: "primeiro_teste_tipo_de_gas", label: "1º Teste (Tipo de Gás)" },
  ],
  historico_pedido_originalis: [
    { key: "nota_fiscal", label: "Nota Fiscal" },
    { key: "ordem_de_producao", label: "Ordem de Produção" },
    { key: "pedido", label: "Pedido" },
    { key: "cliente", label: "Cliente" },
    { key: "control", label: "Control" },
    { key: "data_entrega", label: "Data de Entrega" },
    { key: "estado", label: "Estado" },
    { key: "modelo", label: "Modelo" },
    { key: "opcional", label: "Opcional" },
  ],
};

function formatFieldValue(key, value) {
  if (value === null || value === undefined) return null;
  let normalized = value;
  if (typeof normalized === "string") {
    normalized = normalized.trim();
    if (!normalized) return null;
  }
  if (key === "data_entrega") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("pt-BR");
    }
  }
  return String(normalized);
}

export default function HomeScreen({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [loadingPerfil, setLoadingPerfil] = useState(false);
  const [perfil, setPerfil] = useState(null);

  const [opsLoading, setOpsLoading] = useState(true);
  const [ops, setOps] = useState([]);
  const [codigoManual, setCodigoManual] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [ultimaBusca, setUltimaBusca] = useState("");

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
  async function executarBusca(valor){
    try {
      console.log("[HomeScreen] executando busca", { valor });
      setSearchLoading(true);
      setUltimaBusca(valor);
      setSearchResults([]);
      const data = await apiBuscarCodigo(valor);
      console.log("[HomeScreen] resposta da API", data);
      const list = Array.isArray(data?.results) ? data.results : [];
      console.log("[HomeScreen] resultados normalizados", list);
      setSearchResults(list);
      if (!list.length) {
        Alert.alert("Sem resultados", "Nenhum registro encontrado para o termo informado.");
      }
    } catch (e) {
      console.error("[HomeScreen] erro ao buscar", e);
      const message = e?.message || e?.data?.error || "Falha ao buscar registros.";
      Alert.alert("Erro", message);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSubmitCodigo(){
    const valor = (codigoManual || "").trim();
    if (!valor) {
      Alert.alert("Atenção", "Informe um código (OP, NS ou NF).");
      return;
    }
    await executarBusca(valor);
  }

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
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Inserir OP / NS / NF</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite o código"
            placeholderTextColor="#9CA3AF"
            value={codigoManual}
            onChangeText={setCodigoManual}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmitCodigo}
          />
          <Pressable style={[styles.submitBtn, searchLoading && styles.submitBtnDisabled]} onPress={handleSubmitCodigo} disabled={searchLoading}>
            <Text style={styles.submitTxt}>{searchLoading ? "Buscando..." : "Buscar"}</Text>
          </Pressable>

          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Resultados da busca</Text>
            {searchLoading ? (
              <View style={styles.centerInside}><ActivityIndicator /><Text style={styles.muted}>Buscando registros…</Text></View>
            ) : searchResults.length > 0 ? (
              <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContainer} nestedScrollEnabled>
                {searchResults.map((item, idx) => {
                  const tableKey = item?.tabela;
                  const columnKey = item?.coluna;
                  const tableLabel = TABLE_LABELS[tableKey] || (tableKey ? String(tableKey) : "Tabela desconhecida");
                  const columnLabel = COLUMN_LABELS[columnKey] || (columnKey ? String(columnKey) : "Campo");
                  let detalhes = item?.detalhes || {};
                  if (typeof detalhes === "string") {
                    try {
                      detalhes = JSON.parse(detalhes);
                    } catch (e) {
                      detalhes = {};
                    }
                  }
                  const fieldConfig = TABLE_FIELDS[tableKey] || [];
                  const detailEntries = fieldConfig
                    .map(({ key, label }) => {
                      const formatted = formatFieldValue(key, detalhes?.[key]);
                      if (formatted === null) return null;
                      return { key, label, value: formatted };
                    })
                    .filter(Boolean);

                  return (
                    <View key={`${item.tabela}-${item.coluna}-${item.valor}-${idx}`} style={styles.resultCard}>
                      <Text style={styles.resultValor}>{item.valor}</Text>
                      <Text style={styles.resultMeta}>{columnLabel} • {tableLabel}</Text>
                      {item?.imagem_url ? (
                        <Image
                          source={{ uri: item.imagem_url }}
                          style={styles.resultImage}
                          resizeMode="contain"
                        />
                      ) : null}
                      {detailEntries.length > 0 ? (
                        <View style={styles.detailList}>
                          {detailEntries.map(({ key, label, value }) => (
                            <View key={key} style={styles.detailRow}>
                              <Text style={styles.detailLabel}>{label}</Text>
                              <Text style={styles.detailValue}>{value}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.detailEmpty}>Sem detalhes adicionais.</Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            ) : ultimaBusca ? (
              <Text style={styles.resultEmpty}>Nenhum registro encontrado para "{ultimaBusca}".</Text>
            ) : (
              <Text style={styles.resultHint}>Digite um código para buscar nos históricos.</Text>
            )}
          </View>

          {opsLoading ? (
            <View style={styles.centerInside}><ActivityIndicator /><Text style={styles.muted}>Carregando operações…</Text></View>
          ) : ops.length > 0 ? (
            <View style={styles.sugestoesBox}>
              <Text style={styles.sectionTitle}>Operações atribuídas</Text>
              <ScrollView contentContainerStyle={styles.tagsContainer} horizontal={false} nestedScrollEnabled>
                {ops.map(op => (
                  <Pressable
                    key={String(op)}
                    style={({ pressed }) => [styles.tag, pressed && styles.tagPressed]}
                    onPress={() => {
                      const valor = String(op || "").trim();
                      setCodigoManual(valor);
                      if (valor) executarBusca(valor);
                    }}
                  >
                    <Text style={styles.tagTxt}>{op}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : (
            <Text style={[styles.muted, { marginTop:12 }]}>Sem operações atribuídas.</Text>
          )}
        </View>
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
  formCard:{ backgroundColor:"#111827", borderRadius:16, padding:16, borderWidth:1, borderColor:"#1F2937", flex:1 },
  formTitle:{ color:"#F9FAFB", fontSize:18, fontWeight:"700", marginBottom:12 },
  input:{ borderWidth:1, borderColor:"#374151", backgroundColor:"#0B1220", borderRadius:12, paddingHorizontal:14, paddingVertical:12, color:"#F9FAFB", fontSize:16 },
  submitBtn:{ marginTop:12, backgroundColor:"#2563EB", borderRadius:12, paddingVertical:14, alignItems:"center", borderWidth:1, borderColor:"#1E40AF" },
  submitBtnDisabled:{ opacity:0.7 },
  submitTxt:{ color:"#F9FAFB", fontWeight:"700", fontSize:16 },
  resultsSection:{ marginTop:20, flex:1 },
  sectionTitle:{ color:"#F9FAFB", fontWeight:"600", marginBottom:8, fontSize:16 },
  resultsScroll:{ maxHeight:200, borderWidth:1, borderColor:"#1F2937", borderRadius:12, backgroundColor:"#0B1220" },
  resultsContainer:{ padding:12, gap:12 },
  resultCard:{ backgroundColor:"#111827", borderWidth:1, borderColor:"#1F2937", borderRadius:12, padding:12, gap:8 },
  resultValor:{ color:"#F9FAFB", fontSize:16, fontWeight:"700" },
  resultMeta:{ color:"#93C5FD", marginTop:4, fontSize:13 },
  resultImage:{ width:"100%", height:160, borderRadius:12, backgroundColor:"#0B1220" },
  detailList:{ gap:6 },
  detailRow:{ flexDirection:"row", gap:6, alignItems:"flex-start" },
  detailLabel:{ color:"#D1D5DB", fontWeight:"600", fontSize:13, minWidth:110 },
  detailValue:{ color:"#F3F4F6", fontSize:13, flexShrink:1 },
  detailEmpty:{ color:"#9CA3AF", fontSize:13 },
  resultHint:{ color:"#9CA3AF" },
  resultEmpty:{ color:"#FCD34D" },
  centerInside:{ marginTop:16, alignItems:"center" },
  sugestoesBox:{ marginTop:16, flex:1 },
  tagsContainer:{ flexDirection:"row", flexWrap:"wrap", gap:8 },
  tag:{ backgroundColor:"#1D4ED8", borderRadius:10, paddingVertical:6, paddingHorizontal:10, borderWidth:1, borderColor:"#1E40AF" },
  tagPressed:{ opacity:0.8 },
  tagTxt:{ color:"#E0F2FE", fontWeight:"600" },
  modalOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.45)" },
  modalCard:{ position:"absolute", left:20, right:20, top:"25%", backgroundColor:"#111827", borderWidth:1, borderColor:"#1F2937", borderRadius:16, padding:16 },
  modalTitle:{ color:"#F9FAFB", fontSize:18, fontWeight:"700", marginBottom:8 },
  modalLine:{ color:"#E5E7EB", marginTop:6 },
  closeBtn:{ marginTop:14, backgroundColor:"#374151", borderRadius:10, paddingVertical:10, alignItems:"center" },
  closeTxt:{ color:"#F9FAFB", fontWeight:"700" },
});