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
FRONTEND_ORIGIN=https://seu-projeto.vercel.app
```

O Render fornece `PORT` automaticamente. Após o deploy, `/health` deve retornar `{"status":"OK"}`.

### Vercel

Configure `frontend` como **Root Directory**, `npm run build` como Build Command e `dist` como Output Directory. Adicione:

```text
EXPO_PUBLIC_API_URL=https://seu-backend.onrender.com/api
```

### GitHub

```bash
git add .
git commit -m "Projeto P1"
git push origin main
```

## Acesso por usuário

Ao abrir o app, crie uma conta com nome, e-mail e senha de pelo menos 6 caracteres. Depois do login, cada usuário visualiza e gerencia somente as próprias despesas.

Defina `JWT_SECRET` no `.env` do backend com um segredo forte em ambientes reais.

## Endpoints

- POST `/api/auth/cadastro`
- POST `/api/auth/login`
- POST `/api/financas/despesa`
- GET `/api/financas/despesas`
- PATCH `/api/financas/despesa/:id`
- DELETE `/api/financas/despesa/:id`
- GET `/health`

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
