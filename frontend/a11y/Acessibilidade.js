import React, { createContext, useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'p2.acessibilidade';
const DEFAULT_PREFERENCES = { tema: 'claro', escala: 1 };
const CONTEXT = createContext(null);

const PALETTE = {
  claro: {
    fundo: '#f4f7f6',
    superficie: '#ffffff',
    campo: '#fafcfb',
    texto: '#171717',
    textoSecundario: '#52645d',
    borda: '#cbd7d2',
    erro: '#a52e2e',
    destaque: '#19352b',
    textoDestaque: '#ffffff',
    cartaoTotal: '#19352b'
  },
  escuro: {
    fundo: '#121817',
    superficie: '#1d2522',
    campo: '#252e2a',
    texto: '#f5f7f6',
    textoSecundario: '#c4d2cc',
    borda: '#75847d',
    erro: '#ff9999',
    destaque: '#a8d5c1',
    textoDestaque: '#101a15',
    cartaoTotal: '#263b33'
  }
};

export function AcessibilidadeProvider({ children }) {
  const [preferencias, setPreferencias] = useState(DEFAULT_PREFERENCES);
  const [pronto, setPronto] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let ativo = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw || !ativo) return;
        const saved = JSON.parse(raw);
        setPreferencias({
          tema: saved.tema === 'escuro' ? 'escuro' : 'claro',
          escala: [1, 1.25, 1.5].includes(saved.escala) ? saved.escala : 1
        });
      })
      .catch(() => {
        if (ativo) setAviso('Não foi possível recuperar as preferências salvas.');
      })
      .finally(() => {
        if (ativo) setPronto(true);
      });

    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!pronto) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferencias))
      .then(() => setAviso(''))
      .catch(() => setAviso('Não foi possível salvar as preferências neste dispositivo.'));
  }, [preferencias, pronto]);

  const mudar = (alteracoes) => setPreferencias((atual) => ({ ...atual, ...alteracoes }));

  if (!pronto) {
    return <Text accessibilityRole="text">Carregando preferências de acessibilidade…</Text>;
  }

  return (
    <CONTEXT.Provider value={{
      preferencias,
      mudar,
      cores: PALETTE[preferencias.tema],
      aviso
    }}>
      {children}
    </CONTEXT.Provider>
  );
}

export function useAcessibilidade() {
  const contexto = useContext(CONTEXT);
  if (!contexto) throw new Error('AcessibilidadeProvider deve envolver o aplicativo.');
  return contexto;
}

const DARK_TEXT_COLORS = {
  '#b43b3b': '#ff9999',
  '#19352b': '#d8eee5',
  '#52645d': '#c4d2cc',
  '#718078': '#aebbb5',
  '#b9d2c8': '#c2e3d4',
  '#d7e6df': '#d7e6df',
  '#30483e': '#d8eee5',
  '#253b33': '#e4eee9',
  '#7b8a84': '#aebbb5'
};

export function AText({ style, ...props }) {
  const { preferencias, cores } = useAcessibilidade();
  const adjusted = StyleSheet.flatten(style) || {};
  if (typeof adjusted.fontSize === 'number') adjusted.fontSize *= preferencias.escala;
  if (typeof adjusted.lineHeight === 'number') adjusted.lineHeight *= preferencias.escala;
  if (preferencias.tema === 'escuro' && adjusted.color) {
    adjusted.color = DARK_TEXT_COLORS[adjusted.color.toLowerCase()] || adjusted.color;
  }
  return (
    <Text
      {...props}
      allowFontScaling
      style={[
        { color: cores.texto, fontSize: 16 * preferencias.escala, lineHeight: 24 * preferencias.escala },
        adjusted
      ]}
    />
  );
}

export function AInput({ style, placeholderTextColor, ...props }) {
  const { preferencias, cores } = useAcessibilidade();
  const adjusted = StyleSheet.flatten(style) || {};
  if (typeof adjusted.fontSize === 'number') adjusted.fontSize *= preferencias.escala;
  if (typeof adjusted.lineHeight === 'number') adjusted.lineHeight *= preferencias.escala;
  return (
    <TextInput
      {...props}
      allowFontScaling
      placeholderTextColor={placeholderTextColor || cores.textoSecundario}
      style={[
        adjusted,
        { color: cores.texto, backgroundColor: cores.campo, borderColor: cores.borda,
          fontSize: adjusted.fontSize || 16 }
      ]}
    />
  );
}

export function PainelAcessibilidade() {
  const { preferencias, mudar, cores, aviso } = useAcessibilidade();

  return (
    <ScrollView
      style={{ backgroundColor: cores.superficie }}
      contentContainerStyle={{ padding: 20, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      <AText accessibilityRole="header" style={{ fontSize: 23, fontWeight: '800' }}>
        Acessibilidade
      </AText>
      <AText>Escolha o tema e o tamanho de texto para este aplicativo.</AText>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={`Tema escuro, atualmente ${preferencias.tema}`}
        accessibilityState={{ checked: preferencias.tema === 'escuro' }}
        aria-checked={preferencias.tema === 'escuro'}
        onPress={() => mudar({ tema: preferencias.tema === 'claro' ? 'escuro' : 'claro' })}
        style={{
          minHeight: 52, justifyContent: 'center', padding: 12,
          borderWidth: 1, borderColor: cores.borda, borderRadius: 10
        }}
      >
        <AText>Tema: {preferencias.tema === 'escuro' ? 'escuro' : 'claro'}</AText>
      </Pressable>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Tamanho da fonte"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
      >
        {[1, 1.25, 1.5].map((escala) => (
          <Pressable
            key={escala}
            accessibilityRole="radio"
            accessibilityLabel={`Fonte ${escala * 100} por cento`}
            accessibilityState={{ selected: preferencias.escala === escala }}
            aria-checked={preferencias.escala === escala}
            onPress={() => mudar({ escala })}
            style={{
              minHeight: 52, justifyContent: 'center', paddingHorizontal: 14,
              borderWidth: 1, borderColor: preferencias.escala === escala ? cores.destaque : cores.borda,
              borderRadius: 10, backgroundColor: preferencias.escala === escala ? cores.destaque : cores.superficie
            }}
          >
            <AText style={{
              fontWeight: '700',
              color: preferencias.escala === escala ? cores.textoDestaque : cores.texto
            }}>
              Fonte {escala * 100}%
            </AText>
          </Pressable>
        ))}
      </View>
      <AText accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700' }}>
        Texto de teste
      </AText>
      <AText>
        Esta amostra longa ajuda a conferir leitura, quebra de linha e navegação com a fonte ampliada.
        Os campos, categorias e botões também devem continuar disponíveis sem depender de cor para
        indicar seleção ou erro. O ajuste de fonte do sistema operacional permanece ativo.
      </AText>
      {!!aviso && <AText accessibilityRole="alert" style={{ color: cores.erro }}>{aviso}</AText>}
    </ScrollView>
  );
}
