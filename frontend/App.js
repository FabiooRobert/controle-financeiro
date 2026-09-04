import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || (
  Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api'
);
const CATEGORIAS = ['Alimentação', 'Transporte', 'Lazer', 'Educação', 'Saúde', 'Outros'];

const moeda = (valor) =>
  `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;

export default function App() {
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
      const response = await fetch(`${API_URL}/${modoCadastro ? 'auth/cadastro' : 'auth/login'}`, {
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
      Alert.alert('Erro', error.message || 'Não foi possível acessar sua conta.');
    } finally {
      setCarregando(false);
    }
  }

  async function listarDespesas() {
    try {
      const response = await fetch(`${API_URL}/financas/despesas`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setDespesas(data.data || []);
      setTotal(Number(data.total || 0));
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar as despesas. Verifique o servidor.');
    }
  }

  async function cadastrarDespesa() {
    const descricaoLimpa = descricao.trim();
    if (!descricaoLimpa || !valor.trim()) {
      Alert.alert('Atenção', 'Preencha a descrição e o valor.');
      return;
    }

    if (descricaoLimpa.length < 3 || descricaoLimpa.length > 100) {
      Alert.alert('Atenção', 'A descrição deve ter entre 3 e 100 caracteres.');
      return;
    }

    const numero = Number(valor.replace(',', '.'));
    if (!Number.isFinite(numero) || numero <= 0) {
      Alert.alert('Atenção', 'Digite um valor válido.');
      return;
    }

    const categoriaFinal = categoria === 'Outros' && outraCategoria.trim()
      ? outraCategoria.trim()
      : categoria;
    if (categoriaFinal.length > 40) {
      Alert.alert('Atenção', 'A categoria deve ter no máximo 40 caracteres.');
      return;
    }

    setCarregando(true);
    try {
      const response = await fetch(`${API_URL}/financas/despesa`, {
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
      Alert.alert('Sucesso', data.message);
    } catch (error) {
      Alert.alert('Erro', error.message || 'Erro de conexão com o servidor.');
    } finally {
      setCarregando(false);
    }
  }

  async function excluirDespesa(item) {
    try {
      const response = await fetch(`${API_URL}/financas/despesa/${item._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await listarDespesas();
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível excluir.');
    }
  }

  async function atualizarValor(item, valorAtual) {
    const novoValor = Number(String(valorAtual).replace(',', '.'));
    if (!Number.isFinite(novoValor) || novoValor <= 0) {
      Alert.alert('Atenção', 'Digite um valor válido.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/financas/despesa/${item._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ valor: novoValor })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setValorEditando(null);
      await listarDespesas();
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível atualizar o valor.');
    }
  }

  async function atualizarCategoria(item, novaCategoria) {
    try {
      const response = await fetch(`${API_URL}/financas/despesa/${item._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ categoria: novaCategoria })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      setCategoriaEditando(null);
      await listarDespesas();
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível atualizar a categoria.');
    }
  }

  useEffect(() => { if (token) listarDespesas(); }, [token]);

  if (!token) {
    return (
      <View style={styles.authContainer}>
        <Text style={styles.emoji}>💰</Text>
        <Text style={styles.titulo}>Controle Financeiro</Text>
        <Text style={styles.subtitulo}>{modoCadastro ? 'Crie sua conta' : 'Entre para ver suas despesas'}</Text>
        <View style={styles.authCard}>
          {modoCadastro && <TextInput style={styles.input} placeholder="Seu nome" value={nome} onChangeText={setNome} />}
          <TextInput style={styles.input} placeholder="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Senha (mínimo 6 caracteres)" value={senha} onChangeText={setSenha} secureTextEntry />
          {erroAutenticacao ? <Text style={styles.erroAutenticacao}>{erroAutenticacao}</Text> : null}
          <Pressable style={styles.botao} onPress={autenticar} disabled={carregando}>
            {carregando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>{modoCadastro ? 'CRIAR CONTA' : 'ENTRAR'}</Text>}
          </Pressable>
          <Pressable onPress={() => setModoCadastro(!modoCadastro)}>
            <Text style={styles.link}>{modoCadastro ? 'Já tenho uma conta' : 'Criar uma conta'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.emoji}>💰</Text>
      <Text style={styles.titulo}>Controle Financeiro</Text>
      <Text style={styles.subtitulo}>Organize suas despesas</Text>
      <View style={styles.usuarioLinha}>
        <Text style={styles.usuarioTexto}>Olá, {usuarioNome}</Text>
        <Pressable onPress={() => setToken(null)}><Text style={styles.sair}>Sair</Text></Pressable>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>TOTAL DE DESPESAS</Text>
        <Text style={styles.total}>{moeda(total)}</Text>
        <Text style={styles.quantidade}>{despesas.length} {despesas.length === 1 ? 'despesa' : 'despesas'} cadastradas</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.formLinha}>
          <View style={styles.descricaoCampo}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: Supermercado"
              value={descricao}
              onChangeText={setDescricao}
              maxLength={100}
              editable={!carregando}
            />
          </View>
          <View style={styles.categoriaCampo}>
            <Text style={styles.label}>Categoria</Text>
            <View style={styles.categorias}>
              {CATEGORIAS.map((item) => (
                <React.Fragment key={item}>
                  <Pressable
                    onPress={() => setCategoria(item)}
                    style={[styles.categoria, categoria === item && styles.categoriaAtiva]}
                  >
                    <Text style={[styles.categoriaTexto, categoria === item && styles.categoriaTextoAtiva]}>
                      {item}
                    </Text>
                  </Pressable>
                  {item === 'Outros' && categoria === 'Outros' && (
                    <TextInput
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
            <Text style={styles.label}>Valor</Text>
            <View style={styles.valorInput}>
              <Text style={styles.prefixoMoeda}>R$</Text>
              <TextInput
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
          {carregando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoTexto}>+ CADASTRAR DESPESA</Text>}
        </Pressable>
      </View>

      <Text style={styles.listaTitulo}>📋 Despesas cadastradas</Text>

      {despesas.length === 0 ? (
        <View style={styles.vazio}>
          <Text style={styles.vazioTexto}>Nenhuma despesa cadastrada.</Text>
        </View>
      ) : despesas.map((item) => (
        <View style={styles.item} key={item._id}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemDescricao}>{item.descricao}</Text>
            {categoriaEditando === item._id ? (
              <View style={styles.categoriasEdicao}>
                {CATEGORIAS.map((opcao) => (
                  <Pressable
                    key={opcao}
                    onPress={() => atualizarCategoria(item, opcao)}
                    style={[styles.categoria, opcao === item.categoria && styles.categoriaAtiva]}
                  >
                    <Text style={[styles.categoriaTexto, opcao === item.categoria && styles.categoriaTextoAtiva]}>
                      {opcao}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable onPress={() => setCategoriaEditando(item._id)}>
                <Text style={styles.itemCategoria}>{item.categoria || 'Outros'}</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.itemDireita}>
            {valorEditando === item._id ? (
              <View style={styles.valorEdicao}>
                <Text style={styles.prefixoMoeda}>R$</Text>
                <TextInput
                  style={styles.inputEdicao}
                  defaultValue={String(item.valor).replace('.', ',')}
                  keyboardType="decimal-pad"
                  autoFocus
                  onBlur={(event) => atualizarValor(item, event.nativeEvent.text)}
                  onSubmitEditing={(event) => atualizarValor(item, event.nativeEvent.text)}
                />
              </View>
            ) : (
              <Text style={styles.itemValor}>{moeda(item.valor)}</Text>
            )}
            <View style={styles.acoes}>
              <Pressable onPress={() => setValorEditando(item._id)}>
                <Text style={styles.editar}>Editar</Text>
              </Pressable>
              <Pressable onPress={() => excluirDespesa(item)}>
                <Text style={styles.excluir}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  content: { padding: 22, paddingTop: 55, paddingBottom: 45 },
  authContainer: { flex: 1, backgroundColor: '#f4f7f6', padding: 22, justifyContent: 'center', alignItems: 'center' },
  authCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', padding: 18, borderRadius: 18, marginTop: 18, gap: 12 },
  erroAutenticacao: { color: '#b43b3b', textAlign: 'center', fontWeight: '700' },
  link: { color: '#19352b', textAlign: 'center', fontWeight: '700', padding: 10 },
  usuarioLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  usuarioTexto: { color: '#52645d', fontWeight: '700' },
  sair: { color: '#b43b3b', fontWeight: '700' },
  emoji: { fontSize: 42, textAlign: 'center' },
  titulo: { fontSize: 30, fontWeight: '800', textAlign: 'center', color: '#19352b' },
  subtitulo: { textAlign: 'center', color: '#718078', marginTop: 5, marginBottom: 22, fontSize: 16 },
  totalCard: { backgroundColor: '#19352b', borderRadius: 18, padding: 22, marginBottom: 18 },
  totalLabel: { color: '#b9d2c8', fontSize: 12, fontWeight: '700' },
  total: { color: '#fff', fontSize: 31, fontWeight: '800', marginTop: 5 },
  quantidade: { color: '#d7e6df', marginTop: 5 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 18, marginBottom: 25 },
  formLinha: { flexDirection: 'row', gap: 10 },
  descricaoCampo: { flex: 1 },
  categoriaCampo: { width: '45%' },
  valorLinha: { alignItems: 'flex-start' },
  valorCampo: { width: 125 },
  label: { color: '#30483e', fontWeight: '700', marginBottom: 7, marginTop: 7 },
  input: { borderWidth: 1, borderColor: '#dce5e1', borderRadius: 11, padding: 14, fontSize: 16, backgroundColor: '#fafcfb' },
  valorInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dce5e1', borderRadius: 11, backgroundColor: '#fafcfb', paddingLeft: 14 },
  prefixoMoeda: { color: '#30483e', fontSize: 16, fontWeight: '700' },
  inputValor: { flex: 1, padding: 14, paddingLeft: 8, fontSize: 16 },
  categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  outraCategoriaInput: { width: 145, borderWidth: 1, borderColor: '#dce5e1', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 12, fontSize: 13, backgroundColor: '#fafcfb' },
  categoria: { borderWidth: 1, borderColor: '#d5dfdb', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 12 },
  categoriaAtiva: { backgroundColor: '#19352b', borderColor: '#19352b' },
  categoriaTexto: { color: '#52645d', fontSize: 13 },
  categoriaTextoAtiva: { color: '#fff', fontWeight: '700' },
  botao: { backgroundColor: '#19352b', borderRadius: 11, paddingVertical: 12, paddingHorizontal: 16, alignSelf: 'flex-start', alignItems: 'center', marginTop: 5 },
  botaoTexto: { color: '#fff', fontWeight: '800' },
  listaTitulo: { fontSize: 21, fontWeight: '800', color: '#19352b', marginBottom: 12 },
  item: { backgroundColor: '#fff', borderRadius: 15, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  itemDescricao: { fontSize: 17, fontWeight: '800', color: '#253b33' },
  itemCategoria: { color: '#7b8a84', marginTop: 4, fontSize: 13 },
  itemDireita: { alignItems: 'flex-end', marginLeft: 10 },
  valorEdicao: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dce5e1', borderRadius: 8, paddingLeft: 8 },
  inputEdicao: { width: 72, padding: 7, paddingLeft: 4, fontSize: 15 },
  acoes: { flexDirection: 'row', gap: 12, marginTop: 7 },
  itemValor: { color: '#b43b3b', fontWeight: '800', fontSize: 16 },
  editar: { color: '#19352b', fontSize: 13, fontWeight: '700' },
  excluir: { color: '#b43b3b', marginTop: 7, fontSize: 13, fontWeight: '700' },
  vazio: { backgroundColor: '#fff', borderRadius: 15, padding: 22 },
  vazioTexto: { textAlign: 'center', color: '#7b8a84' }
});