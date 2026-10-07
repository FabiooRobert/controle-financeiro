import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View
} from 'react-native';
import Libras from './a11y/Libras';
import {
  AcessibilidadeProvider, AInput, AText, PainelAcessibilidade, useAcessibilidade
} from './a11y/Acessibilidade';

const webHost = Platform.OS === 'web' && typeof window !== 'undefined'
  ? window.location.hostname
  : 'localhost';
const DEFAULT_API_URL = __DEV__
  ? (Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api'
    : `http://${webHost}:3000/api`)
  : 'https://controle-financeiro-api.onrender.com/api';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
const API_BASE = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;
const CATEGORIAS = ['Alimentação', 'Transporte', 'Lazer', 'Educação', 'Saúde', 'Outros'];

const moeda = (valor) =>
  `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

export default function App() {
  return (
    <AcessibilidadeProvider>
      <AplicativoAcessivel />
    </AcessibilidadeProvider>
  );
}

function AplicativoAcessivel() {
  return (
    <>
      {Platform.OS === 'web' && <Libras />}
      <Financeiro />
    </>
  );
}

function Financeiro() {
  const { preferencias, cores } = useAcessibilidade();
  const [token, setToken] = useState(null);
  const [modoCadastro, setModoCadastro] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [usuarioNome, setUsuarioNome] = useState('');
  const [erroAutenticacao, setErroAutenticacao] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('Outros');
  const [outraCategoria, setOutraCategoria] = useState('');
  const [despesas, setDespesas] = useState([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [valorEditando, setValorEditando] = useState(null);
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [painel, setPainel] = useState(null);
  const [notificacao, setNotificacao] = useState(null);

  function notificar(titulo, mensagem) {
    setNotificacao({ titulo, mensagem });
  }

  async function autenticar() {
    setErroAutenticacao('');
    if (modoCadastro && nome.trim().length < 2) {
      setErroAutenticacao('Informe seu nome.');
      return;
    }
    if (!email.trim() || senha.length < 6) {
      setErroAutenticacao('Informe um e-mail e uma senha com pelo menos 6 caracteres.');
      return;
    }

    setCarregando(true);
    try {
      const response = await fetch(`${API_BASE}/${modoCadastro ? 'auth/cadastro' : 'auth/login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setToken(data.data.token);
      setUsuarioNome(data.data.usuario.nome);
      setSenha('');
    } catch (error) {
      setErroAutenticacao(error.message || 'E-mail ou senha incorretos.');
      notificar('Erro', error.message || 'Não foi possível acessar sua conta.');
    } finally {
      setCarregando(false);
    }
  }

  async function listarDespesas() {
    try {
      const response = await fetch(`${API_BASE}/financas/despesas`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setDespesas(data.data || []);
      setTotal(Number(data.total || 0));
    } catch (error) {
      notificar('Erro', 'Não foi possível carregar as despesas. Verifique o servidor.');
    }
  }

  async function cadastrarDespesa() {
    const descricaoLimpa = descricao.trim();
    if (!descricaoLimpa || !valor.trim()) {
      notificar('Atenção', 'Preencha a descrição e o valor.');
      return;
    }

    if (descricaoLimpa.length < 3 || descricaoLimpa.length > 100) {
      notificar('Atenção', 'A descrição deve ter entre 3 e 100 caracteres.');
      return;
    }

    const numero = Number(valor.replace(',', '.'));
    if (!Number.isFinite(numero) || numero <= 0) {
      notificar('Atenção', 'Digite um valor válido.');
      return;
    }

    const categoriaFinal = categoria === 'Outros' && outraCategoria.trim()
      ? outraCategoria.trim()
      : categoria;
    if (categoriaFinal.length > 40) {
      notificar('Atenção', 'A categoria deve ter no máximo 40 caracteres.');
      return;
    }

    setCarregando(true);
    try {
      const response = await fetch(`${API_BASE}/financas/despesa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ descricao: descricaoLimpa, valor: numero, categoria: categoriaFinal })
      });
      const data = await response.json();

      if (!response.ok || !data.success) throw new Error(data.message || 'Erro ao cadastrar');

      setDescricao('');
      setValor('');
      setCategoria('Outros');
      setOutraCategoria('');
      await listarDespesas();
      notificar('Sucesso', data.message);
    } catch (error) {
      notificar('Erro', error.message || 'Erro de conexão com o servidor.');
    } finally {
      setCarregando(false);
    }
  }

  async function excluirDespesa(item) {
    try {
      const response = await fetch(`${API_BASE}/financas/despesa/${item._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await listarDespesas();
    } catch (error) {
      notificar('Erro', error.message || 'Não foi possível excluir.');
    }
  }

  async function atualizarValor(item, valorAtual) {
    const novoValor = Number(String(valorAtual).replace(',', '.'));
    if (!Number.isFinite(novoValor) || novoValor <= 0) {
      notificar('Atenção', 'Digite um valor válido.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/financas/despesa/${item._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ valor: novoValor })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setValorEditando(null);
      await listarDespesas();
    } catch (error) {
      notificar('Erro', error.message || 'Não foi possível atualizar o valor.');
    }
  }

  async function atualizarCategoria(item, novaCategoria) {
    try {
      const response = await fetch(`${API_BASE}/financas/despesa/${item._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ categoria: novaCategoria })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setCategoriaEditando(null);
      await listarDespesas();
    } catch (error) {
      notificar('Erro', error.message || 'Não foi possível atualizar a categoria.');
    }
  }

  useEffect(() => { if (token) listarDespesas(); }, [token]);

  if (!token) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: cores.fundo }]}
        contentContainerStyle={styles.authContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.acessibilidadeAcoes}>
          <Pressable accessibilityRole="button" onPress={() => setPainel('ajustes')} style={styles.linkBotao}>
            <AText style={styles.link}>Acessibilidade</AText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setPainel('libras')} style={styles.linkBotao}>
            <AText style={styles.link}>Ajuda em Libras</AText>
          </Pressable>
        </View>
        <View style={styles.authHeader}>
          <AText style={styles.emoji}>💰</AText>
          <AText accessibilityRole="header" style={styles.titulo}>Controle Financeiro</AText>
          <AText style={styles.subtitulo}>{modoCadastro ? 'Crie sua conta' : 'Entre para ver suas despesas'}</AText>
        </View>
        <View style={[styles.authCard, { backgroundColor: cores.superficie }]}>
          {modoCadastro && (
            <AInput
              accessibilityLabel="Seu nome"
              style={styles.input}
              placeholder="Seu nome"
              value={nome}
              onChangeText={setNome}
            />
          )}
          <AInput accessibilityLabel="E-mail" style={styles.input} placeholder="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <AInput accessibilityLabel="Senha" style={styles.input} placeholder="Senha (mínimo 6 caracteres)" value={senha} onChangeText={setSenha} secureTextEntry />
          {erroAutenticacao ? <AText accessibilityRole="alert" style={styles.erroAutenticacao}>{erroAutenticacao}</AText> : null}
          <Pressable style={styles.botao} onPress={autenticar} disabled={carregando}>
            {carregando ? <ActivityIndicator color="#fff" /> : <AText style={styles.botaoTexto}>{modoCadastro ? 'CRIAR CONTA' : 'ENTRAR'}</AText>}
          </Pressable>
          <Pressable onPress={() => setModoCadastro(!modoCadastro)}>
            <AText style={styles.link}>{modoCadastro ? 'Já tenho uma conta' : 'Criar uma conta'}</AText>
          </Pressable>
        </View>
        <AcessibilidadeModais
          painel={painel}
          setPainel={setPainel}
          notificacao={notificacao}
          fecharNotificacao={() => setNotificacao(null)}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: cores.fundo }]} contentContainerStyle={styles.content}>
      <View style={styles.acessibilidadeAcoes}>
        <Pressable accessibilityRole="button" onPress={() => setPainel('ajustes')} style={styles.linkBotao}>
          <AText style={styles.link}>Acessibilidade</AText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setPainel('libras')} style={styles.linkBotao}>
          <AText style={styles.link}>Ajuda em Libras</AText>
        </Pressable>
      </View>
      <AText style={styles.emoji}>💰</AText>
      <AText accessibilityRole="header" style={styles.titulo}>Controle Financeiro</AText>
      <AText style={styles.subtitulo}>Organize suas despesas</AText>
      <View style={styles.usuarioLinha}>
        <AText style={styles.usuarioTexto}>Olá, {usuarioNome}</AText>
        <Pressable accessibilityRole="button" accessibilityLabel="Sair da conta" onPress={() => setToken(null)}><AText style={styles.sair}>Sair</AText></Pressable>
      </View>

      <View style={[styles.totalCard, { backgroundColor: cores.cartaoTotal }]}>
        <AText style={styles.totalLabel}>TOTAL DE DESPESAS</AText>
        <AText style={styles.total}>{moeda(total)}</AText>
        <AText style={styles.quantidade}>{despesas.length} {despesas.length === 1 ? 'despesa' : 'despesas'} cadastradas</AText>
      </View>

      <View style={[styles.card, { backgroundColor: cores.superficie }]}>
        <View style={styles.formLinha}>
          <View style={styles.descricaoCampo}>
            <AText style={styles.label}>Descrição</AText>
            <AInput
              accessibilityLabel="Descrição da despesa"
              style={styles.input}
              placeholder="Ex.: Supermercado"
              value={descricao}
              onChangeText={setDescricao}
              maxLength={100}
              editable={!carregando}
            />
          </View>
          <View style={styles.categoriaCampo}>
            <AText style={styles.label}>Categoria</AText>
            <View style={styles.categorias}>
              {CATEGORIAS.map((item) => (
                <React.Fragment key={item}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: categoria === item }}
                    aria-pressed={categoria === item}
                    onPress={() => setCategoria(item)}
                    style={[styles.categoria, categoria === item && styles.categoriaAtiva]}
                  >
                    <AText style={[styles.categoriaTexto, categoria === item && styles.categoriaTextoAtiva]}>
                      {categoria === item ? `✓ ${item}` : item}
                    </AText>
                  </Pressable>
                  {item === 'Outros' && categoria === 'Outros' && (
                    <AInput
                      accessibilityLabel="Outra categoria"
                      style={styles.outraCategoriaInput}
                      placeholder="Digite outra categoria"
                      value={outraCategoria}
                      onChangeText={setOutraCategoria}
                      maxLength={40}
                      editable={!carregando}
                    />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.valorLinha}>
          <View style={styles.valorCampo}>
            <AText style={styles.label}>Valor</AText>
            <View style={[styles.valorInput, { backgroundColor: cores.campo, borderColor: cores.borda }]}>
              <AText style={styles.prefixoMoeda}>R$</AText>
              <AInput
                accessibilityLabel="Valor da despesa em reais"
                style={styles.inputValor}
                placeholder="0,00"
                value={valor}
                onChangeText={setValor}
                keyboardType="decimal-pad"
                editable={!carregando}
              />
            </View>
          </View>
        </View>

        <Pressable style={styles.botao} onPress={cadastrarDespesa} disabled={carregando}>
          {carregando ? <ActivityIndicator color="#fff" /> : <AText style={styles.botaoTexto}>+ CADASTRAR DESPESA</AText>}
        </Pressable>
      </View>

      <AText accessibilityRole="header" style={styles.listaTitulo}>📋 Despesas cadastradas</AText>

      {despesas.length === 0 ? (
        <View style={[styles.vazio, { backgroundColor: cores.superficie }]}>
          <AText style={styles.vazioTexto}>Nenhuma despesa cadastrada.</AText>
        </View>
      ) : despesas.map((item) => (
        <View style={[styles.item, { backgroundColor: cores.superficie }]} key={item._id}>
          <View style={{ flex: 1 }}>
            <AText style={styles.itemDescricao}>{item.descricao}</AText>
            {categoriaEditando === item._id ? (
              <View style={styles.categoriasEdicao}>
                {CATEGORIAS.map((opcao) => (
                  <Pressable
                    key={opcao}
                    accessibilityRole="button"
                    accessibilityState={{ selected: opcao === item.categoria }}
                    aria-pressed={opcao === item.categoria}
                    onPress={() => atualizarCategoria(item, opcao)}
                    style={[styles.categoria, opcao === item.categoria && styles.categoriaAtiva]}
                  >
                    <AText style={[styles.categoriaTexto, opcao === item.categoria && styles.categoriaTextoAtiva]}>
                      {opcao === item.categoria ? `✓ ${opcao}` : opcao}
                    </AText>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel={`Editar categoria ${item.categoria || 'Outros'}`} onPress={() => setCategoriaEditando(item._id)}>
                <AText style={styles.itemCategoria}>{item.categoria || 'Outros'}</AText>
              </Pressable>
            )}
          </View>
          <View style={styles.itemDireita}>
            {valorEditando === item._id ? (
              <View style={[styles.valorEdicao, { borderColor: cores.borda }]}>
                <AText style={styles.prefixoMoeda}>R$</AText>
                <AInput
                  accessibilityLabel={`Novo valor para ${item.descricao}`}
                  style={styles.inputEdicao}
                  defaultValue={String(item.valor).replace('.', ',')}
                  keyboardType="decimal-pad"
                  autoFocus
                  onBlur={(event) => atualizarValor(item, event.nativeEvent.text)}
                  onSubmitEditing={(event) => atualizarValor(item, event.nativeEvent.text)}
                />
              </View>
            ) : (
              <AText style={styles.itemValor}>{moeda(item.valor)}</AText>
            )}
            <View style={styles.acoes}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Editar valor de ${item.descricao}`} onPress={() => setValorEditando(item._id)}>
                <AText style={styles.editar}>Editar</AText>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${item.descricao}`} onPress={() => excluirDespesa(item)}>
                <AText style={styles.excluir}>Excluir</AText>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
      <AcessibilidadeModais
        painel={painel}
        setPainel={setPainel}
        notificacao={notificacao}
        fecharNotificacao={() => setNotificacao(null)}
      />
    </ScrollView>
  );
}

function AcessibilidadeModais({ painel, setPainel, notificacao, fecharNotificacao }) {
  const { cores } = useAcessibilidade();
  return (
    <>
      <Modal
        visible={!!painel}
        animationType="slide"
        transparent
        onRequestClose={() => setPainel(null)}
        statusBarTranslucent
      >
        <View style={styles.modalFundo}>
          <View style={[styles.modalCartao, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
            <View style={[styles.modalCabecalho, { borderBottomColor: cores.borda }]}>
              <AText accessibilityRole="header" style={styles.modalTitulo}>
                {painel === 'ajustes' ? 'Acessibilidade' : 'Ajuda em Libras'}
              </AText>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar painel" onPress={() => setPainel(null)} style={styles.fecharBotao}>
                <AText style={{ fontWeight: '700' }}>Fechar</AText>
              </Pressable>
            </View>
            {painel === 'ajustes'
              ? <PainelAcessibilidade />
              : (
                <ScrollView contentContainerStyle={styles.ajudaConteudo}>
                  <AText>
                    Orientações sobre acesso à conta, cadastro de despesas e atualização de valores e categorias.
                  </AText>
                  {Platform.OS === 'web' ? (
                    <AText>
                      Use o botão flutuante acessível do VLibras para traduzir o conteúdo visível,
                      incluindo esta área de ajuda. A tradução é automática e não foi validada por intérprete.
                    </AText>
                  ) : <Libras />}
                </ScrollView>
              )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!notificacao}
        animationType="fade"
        transparent
        onRequestClose={fecharNotificacao}
      >
        <View style={styles.modalFundo}>
          <View
            accessibilityRole="alert"
            accessibilityViewIsModal
            style={[styles.avisoCartao, { backgroundColor: cores.superficie, borderColor: cores.borda }]}
          >
            <AText accessibilityRole="header" style={styles.modalTitulo}>{notificacao?.titulo}</AText>
            <AText>{notificacao?.mensagem}</AText>
            <Pressable accessibilityRole="button" onPress={fecharNotificacao} style={styles.botao}>
              <AText style={styles.botaoTexto}>Fechar aviso</AText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  content: { padding: 22, paddingTop: 36, paddingBottom: 45 },
  authContainer: { flexGrow: 1, padding: 22, justifyContent: 'center', alignItems: 'center' },
  authHeader: { width: '100%', maxWidth: 480, alignItems: 'center', marginBottom: 18 },
  authCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', padding: 18, borderRadius: 18, gap: 12 },
  erroAutenticacao: { color: '#b43b3b', textAlign: 'center', fontWeight: '700' },
  link: { color: '#19352b', textAlign: 'center', fontWeight: '700', padding: 10 },
  acessibilidadeAcoes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 12 },
  linkBotao: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: '#cbd7d2', borderRadius: 10 },
  usuarioLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  usuarioTexto: { color: '#52645d', fontWeight: '700' },
  sair: { color: '#b43b3b', fontWeight: '700' },
  emoji: { fontSize: 42, textAlign: 'center', marginBottom: 8 },
  titulo: { fontSize: 30, lineHeight: 38, fontWeight: '800', textAlign: 'center', color: '#19352b' },
  subtitulo: { textAlign: 'center', color: '#718078', marginTop: 10, fontSize: 16 },
  totalCard: { backgroundColor: '#19352b', borderRadius: 18, padding: 22, marginBottom: 18 },
  totalLabel: { color: '#b9d2c8', fontSize: 12, fontWeight: '700' },
  total: { color: '#fff', fontSize: 31, fontWeight: '800', marginTop: 5 },
  quantidade: { color: '#d7e6df', marginTop: 5 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 18, marginBottom: 25 },
  formLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  descricaoCampo: { flex: 1, minWidth: 180 },
  categoriaCampo: { flexGrow: 1, flexBasis: '42%', minWidth: 170 },
  valorLinha: { alignItems: 'flex-start' },
  valorCampo: { minWidth: 125, maxWidth: '100%' },
  label: { color: '#30483e', fontWeight: '700', marginBottom: 7, marginTop: 7 },
  input: { borderWidth: 1, borderColor: '#dce5e1', borderRadius: 11, padding: 14, fontSize: 16, backgroundColor: '#fafcfb' },
  valorInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dce5e1', borderRadius: 11, backgroundColor: '#fafcfb', paddingLeft: 14 },
  prefixoMoeda: { color: '#30483e', fontSize: 16, fontWeight: '700' },
  inputValor: { flex: 1, padding: 14, paddingLeft: 8, fontSize: 16 },
  categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  outraCategoriaInput: { minWidth: 145, flexGrow: 1, borderWidth: 1, borderColor: '#dce5e1', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 12, fontSize: 13, backgroundColor: '#fafcfb' },
  categoria: { borderWidth: 1, borderColor: '#d5dfdb', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 12 },
  categoriaAtiva: { backgroundColor: '#19352b', borderColor: '#19352b' },
  categoriaTexto: { color: '#52645d', fontSize: 13 },
  categoriaTextoAtiva: { color: '#fff', fontWeight: '700' },
  botao: { backgroundColor: '#19352b', borderRadius: 11, paddingVertical: 12, paddingHorizontal: 16, alignSelf: 'flex-start', alignItems: 'center', marginTop: 5 },
  botaoTexto: { color: '#fff', fontWeight: '800' },
  listaTitulo: { fontSize: 21, fontWeight: '800', color: '#19352b', marginBottom: 12 },
  item: { backgroundColor: '#fff', borderRadius: 15, padding: 16, marginBottom: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 },
  itemDescricao: { fontSize: 17, fontWeight: '800', color: '#253b33' },
  itemCategoria: { color: '#7b8a84', marginTop: 4, fontSize: 13 },
  itemDireita: { alignItems: 'flex-start', marginLeft: 'auto', maxWidth: '100%' },
  valorEdicao: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dce5e1', borderRadius: 8, paddingLeft: 8 },
  inputEdicao: { minWidth: 90, maxWidth: 160, padding: 7, paddingLeft: 4, fontSize: 15 },
  acoes: { flexDirection: 'row', gap: 12, marginTop: 7 },
  itemValor: { color: '#b43b3b', fontWeight: '800', fontSize: 16 },
  editar: { color: '#19352b', fontSize: 13, fontWeight: '700' },
  excluir: { color: '#b43b3b', marginTop: 7, fontSize: 13, fontWeight: '700' },
  vazio: { backgroundColor: '#fff', borderRadius: 15, padding: 22 },
  vazioTexto: { textAlign: 'center', color: '#7b8a84' },
  modalFundo: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCartao: { width: '100%', maxWidth: 560, maxHeight: '90%', borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  modalCabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 16, borderBottomWidth: 1, borderBottomColor: '#cbd7d2' },
  modalTitulo: { fontSize: 21, fontWeight: '800', flexShrink: 1 },
  fecharBotao: { minHeight: 48, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  ajudaConteudo: { padding: 20, gap: 16 },
  avisoCartao: { width: '100%', maxWidth: 440, borderWidth: 1, borderRadius: 16, padding: 20, gap: 16 }
});