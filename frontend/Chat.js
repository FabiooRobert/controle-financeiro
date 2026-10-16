import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { io } from 'socket.io-client';
import { AInput, AText, useAcessibilidade } from './a11y/Acessibilidade';
import { API_BASE, API_ORIGIN } from './api';

function mesclarMensagens(existing, incoming) {
  const byId = new Map(existing.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()]
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .slice(-100);
}

export default function Chat({ token, userId, onActivity, onIncoming, onSent }) {
  const { cores } = useAcessibilidade();
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('Conectando ao chat');
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const socketRef = useRef(null);
  const lastSentMessageId = useRef(null);
  const callbacks = useRef({ onActivity, onIncoming, onSent });
  callbacks.current = { onActivity, onIncoming, onSent };

  useEffect(() => {
    let active = true;
    const socket = io(API_ORIGIN, { auth: { token } });
    socketRef.current = socket;

    fetch(`${API_BASE}/chat/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Não foi possível carregar o histórico.');
      }
      if (active) {
        setMessages((previous) => mesclarMensagens(previous, result.data));
      }
    }).catch((error) => {
      if (active) setStatus(`Histórico indisponível: ${error.message}`);
    });

    socket.on('connect', () => {
      if (!active) return;
      setConnected(true);
      setStatus('Conectado');
    });
    socket.on('connect_error', (error) => {
      if (!active) return;
      setConnected(false);
      setStatus(`Falha na conexão: ${error.message}`);
    });
    socket.on('disconnect', () => {
      if (!active) return;
      setConnected(false);
      setStatus('Desconectado; tentando reconectar');
    });
    socket.on('chat:message', (message) => {
      if (!active) return;
      setMessages((previous) => mesclarMensagens(previous, [message]));
      if (message.authorId !== userId) callbacks.current.onIncoming?.();
    });
    socket.on('chat:push-status', (result) => {
      if (!active || result.messageId !== lastSentMessageId.current) return;
      setStatus(result.pushSent ? 'Mensagem enviada; notificações solicitadas.' : 'Mensagem enviada; push não disponível.');
    });

    return () => {
      active = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, userId]);

  function enviar() {
    const texto = body.trim();
    callbacks.current.onActivity?.();
    if (!texto || sending || !connected) return;

    setSending(true);
    if (!socketRef.current) {
      setSending(false);
      setStatus('A conexão com o chat foi encerrada.');
      return;
    }
    socketRef.current.timeout(10000).emit('chat:send', { body: texto }, (error, result) => {
      setSending(false);
      if (error) {
        setStatus('Não foi possível confirmar o envio. Verifique o histórico antes de reenviar.');
        return;
      }
      if (!result?.success) {
        setStatus(result?.message || 'Não foi possível enviar a mensagem.');
        return;
      }
      setBody('');
      lastSentMessageId.current = result.messageId;
      callbacks.current.onSent?.();
      setStatus('Mensagem enviada; notificações em processamento.');
    });
  }

  return (
    <View
      style={[styles.container, { backgroundColor: cores.fundo }]}
      onTouchStart={() => callbacks.current.onActivity?.()}
    >
      <AText accessibilityLiveRegion="polite" style={styles.status}>{status}</AText>
      <ScrollView
        ref={listRef}
        contentContainerStyle={styles.messages}
        onScrollBeginDrag={() => callbacks.current.onActivity?.()}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => {
          const own = message.authorId === userId;
          return (
            <View
              key={message.id}
              style={[
                styles.message,
                { backgroundColor: cores.superficie, borderColor: cores.borda },
                own && { alignSelf: 'flex-end', backgroundColor: cores.cartaoTotal }
              ]}
            >
              <AText style={own ? { color: '#fff', fontWeight: '700' } : { fontWeight: '700' }}>
                {own ? 'Você' : message.authorName}
              </AText>
              <AText style={own ? { color: '#fff' } : undefined}>{message.body}</AText>
              <AText style={[styles.timestamp, own && { color: '#d7e6df' }]}>
                {new Date(message.createdAt).toLocaleString()}
              </AText>
            </View>
          );
        })}
      </ScrollView>
      <AInput
        accessibilityLabel="Mensagem para a sala geral"
        placeholder="Escreva uma mensagem"
        value={body}
        onChangeText={(value) => {
          callbacks.current.onActivity?.();
          setBody(value);
        }}
        maxLength={1000}
        multiline
        style={[styles.input, { borderColor: cores.borda }]}
        editable={!sending}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enviar mensagem"
        disabled={!connected || sending || !body.trim()}
        onPress={enviar}
        style={[styles.sendButton, { backgroundColor: cores.destaque }]}
      >
        <AText style={{ color: cores.textoDestaque, fontWeight: '800' }}>
          {sending ? 'Enviando...' : 'Enviar'}
        </AText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 10 },
  status: { minHeight: 24 },
  messages: { flexGrow: 1, gap: 10, paddingVertical: 8 },
  message: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 14,
    maxWidth: '90%',
    padding: 12,
    gap: 4
  },
  timestamp: { fontSize: 12, opacity: 0.8 },
  input: { minHeight: 52, maxHeight: 120, borderWidth: 1, borderRadius: 10, padding: 12 },
  sendButton: { minHeight: 48, borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center' }
});
