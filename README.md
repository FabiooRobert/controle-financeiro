# 💰 Controle Financeiro

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
