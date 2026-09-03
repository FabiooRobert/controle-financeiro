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
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('Outros');
  const [despesas, setDespesas] = useState([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);

  async function listarDespesas() {
    try {
      const response = await fetch(`${API_URL}/financas/despesas`);
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

    setCarregando(true);
    try {
      const response = await fetch(`${API_URL}/financas/despesa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: descricaoLimpa, valor: numero, categoria })
      });
      const data = await response.json();

      if (!response.ok || !data.success) throw new Error(data.message || 'Erro ao cadastrar');

      setDescricao('');
      setValor('');
      setCategoria('Outros');
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
      const response = await fetch(`${API_URL}/financas/despesa/${item._id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      await listarDespesas();
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível excluir.');
    }
  }

  useEffect(() => { listarDespesas(); }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.emoji}>💰</Text>
      <Text style={styles.titulo}>Controle Financeiro</Text>
      <Text style={styles.subtitulo}>Organize suas despesas</Text>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>TOTAL DE DESPESAS</Text>
        <Text style={styles.total}>{moeda(total)}</Text>
        <Text style={styles.quantidade}>{despesas.length} {despesas.length === 1 ? 'despesa' : 'despesas'} cadastradas</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Supermercado"
          value={descricao}
          onChangeText={setDescricao}
          maxLength={100}
          editable={!carregando}
        />

        <Text style={styles.label}>Valor</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: 50,00"
          value={valor}
          onChangeText={setValor}
          keyboardType="decimal-pad"
          editable={!carregando}
        />

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.categorias}>
          {CATEGORIAS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategoria(item)}
              style={[styles.categoria, categoria === item && styles.categoriaAtiva]}
            >
              <Text style={[styles.categoriaTexto, categoria === item && styles.categoriaTextoAtiva]}>
                {item}
              </Text>
            </Pressable>
          ))}
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
            <Text style={styles.itemCategoria}>{item.categoria || 'Outros'}</Text>
          </View>
          <View style={styles.itemDireita}>
            <Text style={styles.itemValor}>{moeda(item.valor)}</Text>
            <Pressable onPress={() => excluirDespesa(item)}>
              <Text style={styles.excluir}>Excluir</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  content: { padding: 22, paddingTop: 55, paddingBottom: 45 },
  emoji: { fontSize: 42, textAlign: 'center' },
  titulo: { fontSize: 30, fontWeight: '800', textAlign: 'center', color: '#19352b' },
  subtitulo: { textAlign: 'center', color: '#718078', marginTop: 5, marginBottom: 22, fontSize: 16 },
  totalCard: { backgroundColor: '#19352b', borderRadius: 18, padding: 22, marginBottom: 18 },
  totalLabel: { color: '#b9d2c8', fontSize: 12, fontWeight: '700' },
  total: { color: '#fff', fontSize: 31, fontWeight: '800', marginTop: 5 },
  quantidade: { color: '#d7e6df', marginTop: 5 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 18, marginBottom: 25 },
  label: { color: '#30483e', fontWeight: '700', marginBottom: 7, marginTop: 7 },
  input: { borderWidth: 1, borderColor: '#dce5e1', borderRadius: 11, padding: 14, fontSize: 16, backgroundColor: '#fafcfb' },
  categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  categoria: { borderWidth: 1, borderColor: '#d5dfdb', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 12 },
  categoriaAtiva: { backgroundColor: '#19352b', borderColor: '#19352b' },
  categoriaTexto: { color: '#52645d', fontSize: 13 },
  categoriaTextoAtiva: { color: '#fff', fontWeight: '700' },
  botao: { backgroundColor: '#19352b', borderRadius: 11, padding: 16, alignItems: 'center', marginTop: 5 },
  botaoTexto: { color: '#fff', fontWeight: '800' },
  listaTitulo: { fontSize: 21, fontWeight: '800', color: '#19352b', marginBottom: 12 },
  item: { backgroundColor: '#fff', borderRadius: 15, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  itemDescricao: { fontSize: 17, fontWeight: '800', color: '#253b33' },
  itemCategoria: { color: '#7b8a84', marginTop: 4, fontSize: 13 },
  itemDireita: { alignItems: 'flex-end', marginLeft: 10 },
  itemValor: { color: '#b43b3b', fontWeight: '800', fontSize: 16 },
  excluir: { color: '#b43b3b', marginTop: 7, fontSize: 13, fontWeight: '700' },
  vazio: { backgroundColor: '#fff', borderRadius: 15, padding: 22 },
  vazioTexto: { textAlign: 'center', color: '#7b8a84' }
});