# Controle Financeiro

Projeto completo com React Native + Node.js/Express + MongoDB.

## Estrutura

- `backend/` API e banco
- `frontend/App.js` aplicativo React Native

## 1. Backend

Entre em `backend`:

```bash
npm install
```

Se houver mais de uma origem, separe as URLs por vírgula. Inclua a URL da Vercel, por exemplo: `https://controle-financeiro-ruby-mu.vercel.app`.

Copie `.env.example` para `.env` e ajuste `MONGODB_URI`. `HOST` fica em `0.0.0.0` para permitir acesso pelo emulador ou celular na rede local.

Depois:


## 3. Publicação em produção

O projeto pode ser publicado separando o frontend e o backend:

```bash
npm run dev
```

A API ficará na porta 3000.

## 2. Frontend

Crie um projeto React Native/Expo e substitua o `App.js` pelo arquivo desta pasta.

Para Android Emulator, a API está configurada como:

`http://10.0.2.2:3000/api`

Se estiver usando celular físico, troque `10.0.2.2` pelo IP local do computador, por exemplo:

`http://192.168.0.10:3000/api`

Para outro endereço no frontend, defina `EXPO_PUBLIC_API_URL` antes de iniciar o Expo. Para restringir o acesso web à API, defina `FRONTEND_ORIGIN` no backend.

### Acessibilidade e Libras

O aplicativo oferece tema claro/escuro e escala de fonte de 100%, 125% e 150%, salvando as duas preferências no dispositivo. O ajuste nativo de fonte do sistema operacional continua habilitado. A área **Ajuda em Libras** carrega o widget oficial VLibras na web para traduzir texto renderizado; essa tradução é automática e não foi revisada por intérprete.

No Android/iOS, o player de Libras aceita `EXPO_PUBLIC_LIBRAS_VIDEO_URL`. Configure apenas um vídeo real, autorizado, com orientações sobre acesso à conta e cadastro/edição de despesas, e disponibilize legendas ou transcrição junto ao conteúdo. Esse material não está incluído no repositório; sem a URL configurada, o aplicativo informa essa pendência em vez de apresentar um vídeo genérico. A variável deve ser definida antes do build Expo.

## 3. Publicação em produção

Arquitetura da P1:

- Frontend: Vercel
- Backend: Render
- Banco: MongoDB Atlas

### MongoDB Atlas

Crie um cluster gratuito, um usuário de banco e permita o acesso do Render em **Network Access**. Configure a connection string somente no painel do Render:

```text
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/controle_financeiro
```

Nunca envie `.env` ou credenciais para o GitHub. Se a senha tiver caracteres especiais, use URL encoding.

### Render

O arquivo `render.yaml` já configura o serviço. No Web Service, confirme:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

Configure no painel do Render:

```text
MONGODB_URI=mongodb+srv://...
JWT_SECRET=um-segredo-forte-e-aleatorio
NODE_ENV=production
FRONTEND_ORIGIN=https://controle-financeiro-ruby-mu.vercel.app
```

O Render fornece `PORT` automaticamente. Após o deploy, `/health` deve retornar `{"status":"OK"}`.

### Vercel

Configure `frontend` como **Root Directory**, `npm run build` como Build Command e `dist` como Output Directory. Adicione:

```text
EXPO_PUBLIC_API_URL=https://controle-financeiro-1-g7xw.onrender.com/api
```

Use a URL real exibida no painel do serviço do Render, mantendo `https://` e o sufixo `/api`. Depois de salvar a variável, faça um novo deploy da Vercel: variáveis `EXPO_PUBLIC_*` são incorporadas durante o build do frontend. Se a variável não existir no ambiente de produção, o navegador tentará acessar `localhost:3000` e exibirá `Failed to fetch`.

### GitHub

```bash
git add .
git commit -m "Projeto P1"
git push origin main
```

## Acesso por usuário

Ao abrir o app, crie uma conta com nome, e-mail e senha de pelo menos 6 caracteres. Depois do login, cada usuário visualiza e gerencia somente as próprias despesas.

Defina `JWT_SECRET` no `.env` do backend com um segredo forte em ambientes reais.

## Recursos P2

O aplicativo mantém a API Node/Express e o MongoDB existentes; não usa Supabase. Após publicar o backend atualizado, faça login novamente: sessões JWT antigas não incluem o identificador de sessão necessário às novas rotas protegidas.

- **Sessão:** encerra após dois minutos sem atividade ou quando o app sai do primeiro plano. O servidor valida uma concessão renovada pelo app e revoga a sessão no logout. Se o aparelho ficar sem rede ou o sistema encerrar o processo, a última concessão pode continuar válida por até dois minutos.
- **Biometria:** opcional e configurada por conta neste aparelho. A senha continua obrigatória; a biometria é uma confirmação local, não MFA remoto. Não há biometria na versão web. É necessário gerar uma nova build nativa após adicionar os plugins.
- **Chat:** sala geral em tempo real com Socket.IO; todas as contas autenticadas podem ler e enviar mensagens. Não envie dados pessoais ou financeiros. A tela carrega as 100 mensagens mais recentes; não há paginação nem expiração automática do histórico.
- **Notificações:** configure FCM v1/APNs no EAS e teste em build de desenvolvimento num aparelho físico; Expo Go não valida push remoto. Os avisos não incluem o texto da mensagem. O registro do aparelho é removido ao sair quando há conexão.
- **Som:** o áudio de exemplo toca ao enviar ou receber mensagens; pode ser silenciado na tela.

As novas coleções `sessoes`, `mensagens` e `pushtokens` são criadas pelo MongoDB/Mongoose. O backend precisa permitir WebSockets para o chat. O arquivo `frontend/app.json` usa o projectId EAS já configurado; ajuste as credenciais FCM/APNs conforme a plataforma. Depois das alterações nativas, faça uma nova build Android/iOS.

Atualize e publique o backend antes do frontend. O backend requer Node.js 18 ou superior para enviar notificações pela API do Expo.

O push é best-effort: não há fila, retentativas ou persistência de receipts; também não há limitação de frequência de mensagens. O histórico do chat não expira automaticamente.

Verificações manuais recomendadas: entrar e sair, cancelar a confirmação biométrica, testar a expiração após dois minutos, conversar com duas contas em aparelhos diferentes, negar permissão de push e testar logout sem rede.

## Endpoints

- POST `/api/auth/cadastro`
- POST `/api/auth/login`
- POST `/api/auth/session/touch`
- POST `/api/auth/logout`
- GET `/api/chat/messages`
- POST/DELETE `/api/notificacoes/token`
- POST `/api/financas/despesa`
- GET `/api/financas/despesas`
- PATCH `/api/financas/despesa/:id`
- DELETE `/api/financas/despesa/:id`
- GET `/health`

O chat em tempo real usa Socket.IO no mesmo host da API.

As rotas de despesas exigem o header `Authorization: Bearer <token>` retornado pelo login.

## Checklist da P1

- Frontend publicado com URL pública
- Backend publicado com `/health` funcionando
- MongoDB Atlas conectado
- APIs de autenticação e despesas funcionando
- Persistência implementada
- Tratamento de erros
- Interface responsiva
- `.env` fora do Git
