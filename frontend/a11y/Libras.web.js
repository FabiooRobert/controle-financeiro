import React, { useEffect, useState } from 'react';
import { AText } from './Acessibilidade';

export default function Libras() {
  const [falha, setFalha] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const existing = document.getElementById('p2-vlibras-script');
    if (existing) return undefined;

    const script = document.createElement('script');
    script.id = 'p2-vlibras-script';
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.async = true;
    script.onload = () => {
      if (window.VLibras) new window.VLibras.Widget('https://vlibras.gov.br/app');
      else setFalha(true);
    };
    script.onerror = () => setFalha(true);
    document.body.appendChild(script);
    return undefined;
  }, []);

  return (
    <>
      {React.createElement('div', { vw: 'true', className: 'enabled' },
        React.createElement('div', { 'vw-access-button': 'true', className: 'active' }),
        React.createElement('div', { 'vw-plugin-wrapper': 'true' },
          React.createElement('div', { className: 'vw-plugin-top-wrapper' })))}
      {falha && (
        <AText accessibilityRole="alert">
          Tradução em Libras indisponível. Verifique a conexão e tente novamente.
        </AText>
      )}
    </>
  );
}
