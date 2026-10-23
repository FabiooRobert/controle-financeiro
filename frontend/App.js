import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAudioPlayer } from 'expo-audio';
import Libras from './a11y/Libras';
import {
  AcessibilidadeProvider, AInput, AText, PainelAcessibilidade, useAcessibilidade
} from './a11y/Acessibilidade';
import Chat from './Chat';
import { API_BASE } from './api';
import { registerPush, unregisterPush } from './notifications';
const CATEGORIAS = ['Alimentação', 'Transporte', 'Lazer', 'Educação', 'Saúde', 'Outros'];
const INACTIVITY_LIMIT_MS = 2 * 60 * 1000;
const NATIVE_KEY_PREFIX = 'native:';
const PUSH_TOKEN_KEY_PREFIX = 'controle-financeiro.push.';

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
  const audio = useAudioPlayer(require('./assets/evento.wav'));
  const [token, setToken] = useState(null);
  const [usuarioId, setUsuarioId] = useState(null);
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
  const [chatAberto, setChatAberto] = useState(false);
  const [somAtivo, setSomAtivo] = useState(true);
  const [biometriaAtiva, setBiometriaAtiva] = useState(false);
  const [pushToken, setPushToken] = useState(null);
  const ultimaAtividade = useRef(Date.now());
  const dialogoNativoAtivo = useRef(false);
  const backgroundDurantePrompt = useRef(false);
  const encerrandoSessao = useRef(false);
  const renovandoSessao = useRef(false);

  function notificar(titulo, mensagem) {
    setNotificacao({ titulo, mensagem });
  }

  function registrarAtividade() {
    ultimaAtividade.current = Date.now();
  }

  async function confirmarBiometria(promptMessage) {
    if (Platform.OS === 'web') throw new Error('A confirmação biométrica requer o aplicativo nativo.');
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync()
    ]);
    if (!hasHardware || !isEnrolled) {
      throw new Error('Configure uma biometria nas opções do aparelho antes de ativar esse recurso.');
    }

    dialogoNativoAtivo.current = true;
    backgroundDurantePrompt.current = false;
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage });
      if (backgroundDurantePrompt.current) {
        throw new Error('Entrada nativa não autorizada.');
      }
      if (!result.success) throw new Error('Confirmação biométrica cancelada ou não reconhecida.');
    } finally {
      dialogoNativoAtivo.current = false;
      backgroundDurantePrompt.current = false;
    }
  }

  async function autenticar() {
    if (encerrandoSessao.current) {
      setErroAutenticacao('Aguarde a sessão anterior ser encerrada.');
      return;
    }
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
    let tokenPendente = null;
    try {
      const response = await fetch(`${API_BASE}/${modoCadastro ? 'auth/cadastro' : 'auth/login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message);
      const { token: novoToken, usuario } = data.data;
      tokenPendente = novoToken;
      let biometriaHabilitada = false;
      try {
        biometriaHabilitada = (await AsyncStorage.getItem(`${NATIVE_KEY_PREFIX}${usuario.id}`)) === 'true';
      } catch (error) {
        throw new Error(`Não foi possível consultar a preferência biométrica: ${error.message}`);
      }

      if (biometriaHabilitada) {
        await confirmarBiometria('Confirmar acesso ao Controle Financeiro');
      }

      const touchResponse = await fetch(`${API_BASE}/auth/session/touch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${novoToken}` }
      });
      if (!touchResponse.ok) throw new Error('Não foi possível iniciar a sessão protegida.');

      setUsuarioId(usuario.id);
      setToken(novoToken);
      setUsuarioNome(usuario.nome);
      setBiometriaAtiva(biometriaHabilitada);
      setPushToken(null);
      registrarAtividade();
      tokenPendente = null;
      setSenha('');
    } catch (error) {
      let mensagem = error.message || 'E-mail ou senha incorretos.';
      if (tokenPendente) {
        try {
          const logoutResponse = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokenPendente}` }
          });
          if (!logoutResponse.ok) throw new Error('o servidor não confirmou a revogação');
        } catch (logoutError) {
          mensagem += ` A revogação remota não foi confirmada (${logoutError.message}); o acesso expira em até dois minutos.`;
        }
      }
      setErroAutenticacao(mensagem);
      notificar('Erro', mensagem);
    } finally {
      setCarregando(false);
    }
  }

  async function encerrarSessao(motivo = 'Sessão encerrada', mostrarMotivo = true) {
    if (encerrandoSessao.current) return;
    encerrandoSessao.current = true;
    const tokenAtual = token;
    const usuarioAtual = usuarioId;
    const tokenPushAtual = pushToken;
    setToken(null);
    setUsuarioId(null);
    setUsuarioNome('');
    setDespesas([]);
    setTotal(0);
    setChatAberto(false);
    setPushToken(null);
    setBiometriaAtiva(false);
    setSenha('');
    if (!mostrarMotivo) setErroAutenticacao('');
    const falhas = [];

    try {
      if (tokenAtual && usuarioAtual) {
        let tokenParaRemover = tokenPushAtual;
        if (!tokenParaRemover) {
          tokenParaRemover = await AsyncStorage.getItem(`${PUSH_TOKEN_KEY_PREFIX}${usuarioAtual}`);
        }
        if (tokenParaRemover) {
          await unregisterPush(tokenAtual, tokenParaRemover);
          await AsyncStorage.removeItem(`${PUSH_TOKEN_KEY_PREFIX}${usuarioAtual}`);
        }
      }
    } catch (error) {
      falhas.push(`não foi possível remover o registro de notificações (${error.message})`);
    }

    try {
      if (tokenAtual) {
        const response = await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenAtual}` }
        });
        if (!response.ok) throw new Error('o servidor não confirmou a revogação');
      }
    } catch (error) {
      falhas.push(`${error.message}; o acesso remoto expira em até dois minutos`);
    } finally {
      encerrandoSessao.current = false;
    }

    if (mostrarMotivo) {
      setErroAutenticacao(falhas.length ? `${motivo}. ${falhas.join('; ')}.` : motivo);
    } else if (falhas.length) {
      setErroAutenticacao(`Sessão encerrada, mas ${falhas.join('; ')}.`);
    }
  }

  async function alternarBiometria() {
    if (biometriaAtiva) {
      await AsyncStorage.removeItem(`${NATIVE_KEY_PREFIX}${usuarioId}`);
      setBiometriaAtiva(false);
      notificar('Biometria desativada', 'O próximo acesso continuará protegido pela senha da conta.');
      return;
    }

    await confirmarBiometria('Ativar confirmação biométrica');
    await AsyncStorage.setItem(`${NATIVE_KEY_PREFIX}${usuarioId}`, 'true');
    setBiometriaAtiva(true);
    notificar('Biometria ativada', 'A senha da conta continuará sendo necessária em cada novo acesso.');
  }

  async function ativarNotificacoes() {
    dialogoNativoAtivo.current = true;
    try {
      const tokenRegistrado = await registerPush(token);
      if (!tokenRegistrado) {
        notificar('Notificações não ativadas', 'A permissão foi negada. O aplicativo continuará disponível.');
        return;
      }
      await AsyncStorage.setItem(`${PUSH_TOKEN_KEY_PREFIX}${usuarioId}`, tokenRegistrado);
      setPushToken(tokenRegistrado);
      notificar('Notificações ativadas', 'Este aparelho poderá receber avisos genéricos de novas mensagens.');
    } finally {
      dialogoNativoAtivo.current = false;
    }
  }

  function tocarSom() {
    if (!somAtivo) return;
    audio.seekTo(0);
    audio.play();
  }

  useEffect(() => {
    if (!token) return undefined;

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (dialogoNativoAtivo.current) {
        if (state === 'inactive') return;
        if (state === 'background') {
          backgroundDurantePrompt.current = true;
          void encerrarSessao('Aplicativo em segundo plano');
        }
        return;
      }
      if (state === 'active') return;
      void encerrarSessao('Sessão encerrada ao sair do aplicativo');
    });

    const timer = setInterval(async () => {
      if (renovandoSessao.current || encerrandoSessao.current) return;
      if (Date.now() - ultimaAtividade.current >= INACTIVITY_LIMIT_MS) {
        void encerrarSessao('Sessão expirada por inatividade');
        return;
      }

      renovandoSessao.current = true;
      try {
        const response = await fetch(`${API_BASE}/auth/session/touch`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Não foi possível validar a sessão no servidor.');
      } catch (error) {
        void encerrarSessao(error.message);
      } finally {
        renovandoSessao.current = false;
      }
    }, 10000);

    return () => {
      appStateSubscription.remove();
      clearInterval(timer);
    };
  }, [token]);

  useEffect(() => {
    if (!token || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const events = ['pointerdown', 'keydown', 'scroll'];
    const handleActivity = () => registrarAtividade();
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, true));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity, true));
    };
  }, [token]);

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

  if (chatAberto) {
    return (
      <View
        style={[styles.chatTela, { backgroundColor: cores.fundo }]}
        onTouchStart={registrarAtividade}
      >
        <View style={[styles.chatCabecalho, { borderBottomColor: cores.borda }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar para as despesas"
            onPress={() => setChatAberto(false)}
            style={styles.linkBotao}
          >
            <AText style={styles.link}>Voltar</AText>
          </Pressable>
          <AText accessibilityRole="header" style={styles.chatTitulo}>Sala geral</AText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={somAtivo ? 'Silenciar sons' : 'Ativar sons'}
            onPress={() => setSomAtivo((current) => !current)}
            style={styles.linkBotao}
          >
            <AText style={styles.link}>{somAtivo ? 'Som: ligado' : 'Som: desligado'}</AText>
          </Pressable>
        </View>
        <AText style={styles.chatAviso}>
          As mensagens são visíveis para todas as contas do aplicativo. Não envie dados financeiros ou pessoais.
        </AText>
        <Chat
          token={token}
          userId={usuarioId}
          onActivity={registrarAtividade}
          onIncoming={tocarSom}
          onSent={tocarSom}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cores.fundo }]}
      contentContainerStyle={styles.content}
      onTouchStart={registrarAtividade}
    >
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          onPress={() => void encerrarSessao('Sessão encerrada', false)}
        >
          <AText style={styles.sair}>Sair</AText>
        </Pressable>
      </View>

      <View style={styles.recursoLinha}>
        <Pressable accessibilityRole="button" style={styles.linkBotao} onPress={() => setChatAberto(true)}>
          <AText style={styles.link}>Abrir sala geral</AText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={somAtivo ? 'Silenciar sons' : 'Ativar sons'}
          style={styles.linkBotao}
          onPress={() => setSomAtivo((current) => !current)}
        >
          <AText style={styles.link}>{somAtivo ? 'Som: ligado' : 'Som: desligado'}</AText>
        </Pressable>
      </View>
      <AText style={styles.chatAviso}>
        A sala geral é visível para todas as contas. Não envie dados financeiros ou pessoais.
      </AText>
      <View style={styles.recursoLinha}>
        <Pressable
          accessibilityRole="button"
          style={styles.linkBotao}
          onPress={() => void alternarBiometria().catch((error) => notificar('Biometria indisponível', error.message))}
        >
          <AText style={styles.link}>{biometriaAtiva ? 'Desativar biometria' : 'Ativar biometria'}</AText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.linkBotao}
          onPress={() => void ativarNotificacoes().catch((error) => notificar('Notificações indisponíveis', error.message))}
        >
          <AText style={styles.link}>{pushToken ? 'Notificações ativadas' : 'Ativar notificações'}</AText>
        </Pressable>
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
  recursoLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chatTela: { flex: 1, paddingTop: 36 },
  chatCabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1 },
  chatTitulo: { fontSize: 20, fontWeight: '800' },
  chatAviso: { marginHorizontal: 14, marginTop: 8, marginBottom: 4, fontSize: 13 },
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