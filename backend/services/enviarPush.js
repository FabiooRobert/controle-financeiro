const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

async function enviarPush(tokens) {
  let enviados = 0;
  let falhos = 0;

  for (let index = 0; index < tokens.length; index += CHUNK_SIZE) {
    const chunk = tokens.slice(index, index + CHUNK_SIZE);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify(chunk.map((to) => ({
        to,
        title: 'Nova mensagem',
        body: 'Há uma nova mensagem no chat.',
        data: { type: 'chat' },
        channelId: 'mensagens',
        sound: 'default'
      })))
    });

    const result = await response.json();
    if (!response.ok || !Array.isArray(result.data)) {
      throw new Error('O serviço de notificações não aceitou o envio');
    }

    for (const ticket of result.data) {
      if (ticket.status === 'ok') enviados += 1;
      else falhos += 1;
    }
  }

  return { enviados, falhos };
}

module.exports = { enviarPush };
