import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator, Alert, ScrollView, TextInput, Image, BackHandler } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiGetProfile, apiBuscarCodigo, apiListaPecas } from "../services/api";

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

function formatQuantidade(valor) {
  if (valor === null || valor === undefined) return "-";
  const numero = Number(valor);
  if (Number.isNaN(numero)) return String(valor);
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export default function HomeScreen({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [loadingPerfil, setLoadingPerfil] = useState(false);
  const [perfil, setPerfil] = useState(null);

  const [codigoManual, setCodigoManual] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [ultimaBusca, setUltimaBusca] = useState("");
  const [pecasVisible, setPecasVisible] = useState(false);
  const [pecasLoading, setPecasLoading] = useState(false);
  const [pecasData, setPecasData] = useState(null);
  const [pecasErro, setPecasErro] = useState("");
  const [pecasOrdem, setPecasOrdem] = useState("");
  const [pecaDetalhe, setPecaDetalhe] = useState(null);

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

  const closePecas = useCallback(() => {
    setPecasVisible(false);
    setPecasData(null);
    setPecasErro("");
    setPecasOrdem("");
    setPecasLoading(false);
    setPecaDetalhe(null);
  }, []);

  useEffect(() => {
    if (!pecasVisible) return;
    const onBackPress = () => {
      if (pecaDetalhe) {
        setPecaDetalhe(null);
        return true;
      }
      closePecas();
      return true;
    };
    const subscription = BackHandler?.addEventListener?.("hardwareBackPress", onBackPress);
    const handleKeyDown = (event) => {
      if (event?.key === "Escape") {
        event.preventDefault();
        if (pecaDetalhe) {
          setPecaDetalhe(null);
        } else {
          closePecas();
        }
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      subscription?.remove?.();
      if (typeof document !== "undefined") {
        document.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [pecasVisible, closePecas, pecaDetalhe]);

  async function handleListaPecas(item, detalheObj){
    let detalhes = detalheObj;
    if (!detalhes || typeof detalhes !== "object") {
      if (typeof item?.detalhes === "string") {
        try { detalhes = JSON.parse(item.detalhes); }
        catch (e) { detalhes = {}; }
      } else if (item?.detalhes && typeof item.detalhes === "object") {
        detalhes = item.detalhes;
      } else {
        detalhes = {};
      }
    }

    const ordem = String(
      detalhes?.ordem_de_producao ??
      (item?.coluna === "ordem_de_producao" ? item.valor : "") ??
      ""
    ).trim();

    if (!ordem) {
      Alert.alert("Sem ordem", "Não foi possível identificar a ordem de produção para este registro.");
      return;
    }

    setPecasVisible(true);
    setPecasLoading(true);
    setPecasErro("");
    setPecasData(null);
    setPecasOrdem(ordem);

    try {
      const data = await apiListaPecas(ordem);
      if (data && typeof data === "object") {
        setPecasData(data);
        if (!Array.isArray(data.fichas) || data.fichas.length === 0) {
          setPecasErro("Nenhuma peça encontrada para esta OP.");
        }
      } else {
        setPecasErro("Resposta inesperada do servidor.");
      }
    } catch (e) {
      console.error("[HomeScreen] erro lista de peças", e);
      const message = e?.message || e?.data?.error || "Falha ao carregar lista de peças.";
      setPecasErro(message);
      Alert.alert("Erro", message);
    } finally {
      setPecasLoading(false);
    }
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
                  const ordemRef = String(
                    detalhes?.ordem_de_producao ??
                    (item?.coluna === "ordem_de_producao" ? item.valor : "") ??
                    ""
                  ).trim();

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
                      {ordemRef ? (
                        <Pressable style={styles.piecesButton} onPress={() => handleListaPecas(item, detalhes)}>
                          <Text style={styles.piecesButtonText}>Lista de peças</Text>
                        </Pressable>
                      ) : null}
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

      {pecasVisible && (
        <View style={styles.piecesPortal} pointerEvents="box-none">
          <Pressable style={styles.piecesScrim} onPress={closePecas} />
          <View style={styles.piecesCard}>
            <View style={styles.piecesHeader}>
              <Text style={styles.piecesTitle}>Lista de peças • OP {pecasOrdem || pecasData?.ordem || ""}</Text>
              <Pressable onPress={closePecas} style={styles.piecesClose} hitSlop={10}>
                <Ionicons name="close" size={20} color="#F9FAFB" />
              </Pressable>
            </View>
            {pecasLoading ? (
              <View style={styles.centerInside}><ActivityIndicator /><Text style={styles.muted}>Carregando peças…</Text></View>
            ) : pecasErro ? (
              <View style={styles.centerInside}><Text style={styles.piecesEmpty}>{pecasErro}</Text></View>
            ) : Array.isArray(pecasData?.fichas) && pecasData.fichas.length ? (
              <ScrollView style={styles.piecesScroll} contentContainerStyle={styles.piecesContainer} nestedScrollEnabled>
                {pecasData.fichas.map((ficha, fichaIdx) => (
                  <View key={`${ficha.identificacao_da_ficha_tecnica || "ficha"}-${fichaIdx}`} style={styles.piecesFicha}>
                    <Text style={styles.piecesFichaTitle}>Ficha técnica {ficha.identificacao_da_ficha_tecnica || "—"}</Text>
                    <Text style={styles.piecesFichaMeta}>
                      Produto: {ficha?.identificacao?.identificacao_do_produto || "—"}
                      {" • "}
                      {ficha?.identificacao?.descricao_do_produto || "Sem descrição"}
                    </Text>
                    {Array.isArray(ficha.operacoes) && ficha.operacoes.length ? (
                      ficha.operacoes.map((operacao, opIdx) => (
                        <View key={`${ficha.identificacao_da_ficha_tecnica || "ficha"}-${opIdx}`} style={styles.piecesGroup}>
                          <Text style={styles.piecesGroupTitle}>{operacao.descricao_da_operacao || "Operação sem descrição"}</Text>
                          {Array.isArray(operacao.itens) && operacao.itens.length ? (
                            <View style={styles.piecesItemsList}>
                              {operacao.itens.map((peca, linhaIdx) => (
                                <Pressable
                                  key={`${operacao.descricao_da_operacao || opIdx}-${peca.identificacao_do_produto_consumido || linhaIdx}`}
                                  style={({ pressed }) => [
                                    styles.pieceItem,
                                    pressed && styles.pieceItemPressed,
                                  ]}
                                  onPress={() => setPecaDetalhe({
                                    identificacao: peca.identificacao_do_produto_consumido || "-",
                                    descricao: peca.descricao_do_produto_consumido || "Sem descrição disponível.",
                                    quantidade: formatQuantidade(peca.quantidade_prevista_de_consumo),
                                    operacao: operacao.descricao_da_operacao || "Operação",
                                    ficha: ficha.identificacao_da_ficha_tecnica || "—",
                                  })}
                                >
                                  <View style={styles.pieceField}>
                                    <Text style={styles.pieceFieldLabel}>Identificação</Text>
                                    <Text style={styles.pieceFieldValue} numberOfLines={2}>
                                      {peca.identificacao_do_produto_consumido || "-"}
                                    </Text>
                                  </View>
                                  <View style={styles.pieceField}>
                                    <Text style={styles.pieceFieldLabel}>Descrição</Text>
                                    <Text style={styles.pieceFieldValue} numberOfLines={3}>
                                      {peca.descricao_do_produto_consumido || "-"}
                                    </Text>
                                  </View>
                                  <View style={[styles.pieceField, styles.pieceFieldQtd]}>
                                    <Text style={styles.pieceFieldLabel}>Qtd. prevista</Text>
                                    <Text style={styles.pieceFieldValue}>{formatQuantidade(peca.quantidade_prevista_de_consumo)}</Text>
                                  </View>
                                </Pressable>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.piecesEmpty}>Sem itens para esta operação.</Text>
                          )}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.piecesEmpty}>Nenhuma operação encontrada.</Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.centerInside}><Text style={styles.piecesEmpty}>Nenhuma peça encontrada.</Text></View>
            )}
          </View>
          {pecaDetalhe && (
            <View style={styles.pieceDetailPortal} pointerEvents="box-none">
              <Pressable style={styles.pieceDetailScrim} onPress={() => setPecaDetalhe(null)} />
              <View style={styles.pieceDetailCard}>
                <View style={styles.pieceDetailHeader}>
                  <View style={{ flexShrink:1, paddingRight:12 }}>
                    <Text style={styles.pieceDetailTitle}>{pecaDetalhe.identificacao}</Text>
                    <Text style={styles.pieceDetailMeta}>Ficha {pecaDetalhe.ficha} • {pecaDetalhe.operacao}</Text>
                  </View>
                  <Pressable onPress={() => setPecaDetalhe(null)} style={styles.pieceDetailClose} hitSlop={10}>
                    <Ionicons name="close" size={18} color="#0F172A" />
                  </Pressable>
                </View>
                <ScrollView style={styles.pieceDetailScroll}>
                  <Text style={styles.pieceDetailLabel}>Descrição completa</Text>
                  <Text style={styles.pieceDetailDescription}>{pecaDetalhe.descricao}</Text>
                  <Text style={[styles.pieceDetailLabel, { marginTop:16 }]}>Quantidade prevista</Text>
                  <Text style={styles.pieceDetailDescription}>{pecaDetalhe.quantidade}</Text>
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      )}
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
  resultsSection:{ marginTop:20, flex:1, alignSelf:"stretch" },
  sectionTitle:{ color:"#F9FAFB", fontWeight:"600", marginBottom:8, fontSize:16 },
  resultsScroll:{ flex:1, borderWidth:1, borderColor:"#1F2937", borderRadius:12, backgroundColor:"#0B1220" },
  resultsContainer:{ padding:16, gap:16 },
  resultCard:{ backgroundColor:"#111827", borderWidth:1, borderColor:"#1F2937", borderRadius:16, padding:18, gap:16, shadowColor:"#000", shadowOpacity:0.35, shadowRadius:12, shadowOffset:{ width:0, height:6 }, elevation:6 },
  resultValor:{ color:"#F9FAFB", fontSize:16, fontWeight:"700" },
  resultMeta:{ color:"#93C5FD", marginTop:4, fontSize:13 },
  resultImage:{ width:"100%", height:160, borderRadius:12, backgroundColor:"#0B1220" },
  detailList:{ gap:12 },
  detailRow:{ backgroundColor:"#0B1220", borderRadius:12, padding:12, borderWidth:1, borderColor:"#1F2937" },
  detailLabel:{ color:"#94A3B8", fontWeight:"600", fontSize:12, textTransform:"uppercase", letterSpacing:0.5 },
  detailValue:{ color:"#F9FAFB", fontSize:14, marginTop:4, lineHeight:20 },
  detailEmpty:{ color:"#9CA3AF", fontSize:13 },
  piecesButton:{ marginTop:14, alignSelf:"flex-start", backgroundColor:"#10B981", borderRadius:10, paddingHorizontal:16, paddingVertical:10, borderWidth:1, borderColor:"#047857" },
  piecesButtonText:{ color:"#ECFDF5", fontWeight:"700", fontSize:14 },
  resultHint:{ color:"#9CA3AF" },
  resultEmpty:{ color:"#FCD34D" },
  centerInside:{ marginTop:16, alignItems:"center" },
  modalOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.45)" },
  modalCard:{ position:"absolute", left:20, right:20, top:"25%", backgroundColor:"#111827", borderWidth:1, borderColor:"#1F2937", borderRadius:16, padding:16 },
  modalTitle:{ color:"#F9FAFB", fontSize:18, fontWeight:"700", marginBottom:8 },
  modalLine:{ color:"#E5E7EB", marginTop:6 },
  closeBtn:{ marginTop:14, backgroundColor:"#374151", borderRadius:10, paddingVertical:10, alignItems:"center" },
  closeTxt:{ color:"#F9FAFB", fontWeight:"700" },
  piecesPortal:{ ...StyleSheet.absoluteFillObject, zIndex:30, justifyContent:"center", alignItems:"center", padding:20 },
  piecesScrim:{ ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(15,23,42,0.85)" },
  piecesCard:{ width:"100%", maxWidth:960, maxHeight:"90%", backgroundColor:"#0B1220", borderRadius:18, borderWidth:1, borderColor:"#1F2937", padding:16, zIndex:31, shadowColor:"#000", shadowOpacity:0.4, shadowRadius:12, shadowOffset:{ width:0, height:6 }, elevation:8 },
  piecesHeader:{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
  piecesTitle:{ color:"#F9FAFB", fontSize:18, fontWeight:"700", flexShrink:1, paddingRight:12 },
  piecesClose:{ width:32, height:32, borderRadius:16, alignItems:"center", justifyContent:"center", backgroundColor:"#1F2937", borderWidth:1, borderColor:"#374151" },
  piecesScroll:{ maxHeight:480, borderRadius:12, width:"100%" },
  piecesContainer:{ paddingBottom:24, gap:20, paddingHorizontal:4 },
  piecesFicha:{ borderWidth:1, borderColor:"#1F2937", borderRadius:16, padding:16, backgroundColor:"#111827", gap:16 },
  piecesFichaTitle:{ color:"#F9FAFB", fontWeight:"700", fontSize:16 },
  piecesFichaMeta:{ color:"#CBD5F5", fontSize:13, lineHeight:18 },
  piecesGroup:{ gap:12, borderWidth:1, borderColor:"#1F2937", borderRadius:14, padding:14, backgroundColor:"#0F172A" },
  piecesGroupTitle:{ color:"#93C5FD", fontWeight:"700", fontSize:14, textTransform:"uppercase", letterSpacing:0.6 },
  piecesItemsList:{ gap:12 },
  pieceItem:{ borderWidth:1, borderColor:"#1F2937", borderRadius:12, padding:12, backgroundColor:"#111C34", gap:10 },
  pieceItemPressed:{ backgroundColor:"#1A2440" },
  pieceField:{ gap:4 },
  pieceFieldLabel:{ color:"#94A3B8", fontSize:11, letterSpacing:0.4, textTransform:"uppercase" },
  pieceFieldValue:{ color:"#F8FAFC", fontSize:14, lineHeight:20 },
  pieceFieldQtd:{ alignItems:"flex-end" },
  piecesEmpty:{ color:"#9CA3AF", fontSize:13, marginTop:8 },
  pieceDetailPortal:{ ...StyleSheet.absoluteFillObject, justifyContent:"flex-end", padding:20, zIndex:50 },
  pieceDetailScrim:{ ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(15,23,42,0.65)" },
  pieceDetailCard:{ backgroundColor:"#E2E8F0", borderRadius:20, padding:18, maxHeight:"70%", shadowColor:"#000", shadowOpacity:0.35, shadowRadius:18, shadowOffset:{ width:0, height:10 }, elevation:12 },
  pieceDetailHeader:{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
  pieceDetailTitle:{ color:"#0F172A", fontSize:16, fontWeight:"800" },
  pieceDetailMeta:{ color:"#1E293B", fontSize:12, marginTop:2 },
  pieceDetailClose:{ width:30, height:30, borderRadius:15, backgroundColor:"#CBD5F5", alignItems:"center", justifyContent:"center" },
  pieceDetailScroll:{ maxHeight:220 },
  pieceDetailLabel:{ color:"#0F172A", fontSize:12, fontWeight:"700", textTransform:"uppercase", letterSpacing:0.6 },
  pieceDetailDescription:{ color:"#1E293B", fontSize:14, lineHeight:22, marginTop:6 },
});