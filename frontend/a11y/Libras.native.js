import React, { useState } from 'react';
import { View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { AText } from './Acessibilidade';

function VideoLibras({ uri }) {
  const [erro, setErro] = useState(false);
  const player = useVideoPlayer(uri, (instance) => {
    instance.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') setErro(true);
      if (error) setErro(true);
    });
  });

  return (
    <View style={{ gap: 12 }}>
      <VideoView
        player={player}
        nativeControls
        accessibilityLabel="Vídeo com orientação em Libras sobre o fluxo principal"
        style={{ width: '100%', aspectRatio: 16 / 9, maxHeight: 300 }}
      />
      <AText>Use os controles do vídeo para iniciar, pausar ou ativar legendas, se disponíveis.</AText>
      {!!erro && (
        <AText accessibilityRole="alert" style={{ color: '#b43b3b' }}>
          Não foi possível carregar o vídeo de orientação em Libras. Verifique a conexão.
        </AText>
      )}
    </View>
  );
}

export default function Libras() {
  const uri = process.env.EXPO_PUBLIC_LIBRAS_VIDEO_URL;
  if (uri) return <VideoLibras uri={uri} />;

  return (
    <AText>
      Ainda não há vídeo de orientação em Libras revisado e autorizado neste aplicativo. Configure
      EXPO_PUBLIC_LIBRAS_VIDEO_URL com um vídeo real, legendado e referente ao fluxo principal para
      disponibilizar o conteúdo nativo.
    </AText>
  );
}
