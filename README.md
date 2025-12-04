# Central · ID | Dashboard Operacional

Aplicação full stack que concentra a comunicação com relógios Control iD e oferece um dashboard administrativo para RH/TI. 

<div style="display: inline_block"><br/>
    <img align="center" alt="Typescript" src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=TypeScript&logoColor=white"/>
    <img align="center" alt="React" src="https://img.shields.io/badge/React-61DAFB.svg?style=for-the-badge&logo=React&logoColor=black"/>
    <img align="center" alt="Nodejs" src="https://img.shields.io/badge/Node.js-5FA04E.svg?style=for-the-badge&logo=nodedotjs&logoColor=white"/>
    <img align="center" alt="Prisma ORM" src="https://img.shields.io/badge/Prisma-2D3748.svg?style=for-the-badge&logo=Prisma&logoColor=white"/>
    <img align="center" alt="SQLite" src="https://img.shields.io/badge/SQLite-003B57.svg?style=for-the-badge&logo=SQLite&logoColor=white"/>
    <img align="center" alt="Shadcn" src="https://img.shields.io/badge/shadcn/ui-000000.svg?style=for-the-badge&logo=shadcn/ui&logoColor=white"/>
</div>

## 🖼️ Screenshot

<!-- Substitua o caminho abaixo após exportar uma imagem do projeto -->
![Prévia do dashboard](docs/screenshot-placeholder.png)

## ✨ Principais recursos
- API Node.js/Express que se integra aos relógios Control iD via cURL.
- Persistência local com SQLite (sql.js) para autenticação e controle de acesso.
- Frontend React + Vite com autenticação baseada em JWT e roles Admin/Padrão.
- Scripts para desenvolvimento em Windows (`start-dev.bat`) executando front e back em paralelo.

## 🧱 Estrutura em alto nível
```
root
├─ backend/      # API Express + integrações Control iD
├─ frontend/     # SPA React consumindo a API
├─ start-dev.bat # Script que sobe as duas camadas em dev
└─ TECHNICAL_OVERVIEW.md # Documentação técnica detalhada
```

## 🔐 Variáveis de ambiente
Nenhum segredo é versionado. Copie `backend/.env.example` e ajuste **antes** de rodar a API:

```powershell
cd backend
copy .env.example .env
```

Campos que exigem atenção:
- `AUTH_JWT_SECRET`: defina uma chave forte para assinar os tokens.
- `AUTH_DEFAULT_ADMIN_*` / `AUTH_SECOND_ADMIN_*`: credenciais seed criadas no primeiro boot (troque após o login inicial).
- `CONTROL_ID_*`: informe usuário/senha reais dos relógios Control iD.

No frontend, crie um `.env` caso queira apontar para um host/API diferente usando `VITE_BACKEND_URL` ou `VITE_BACKEND_PORT`.

## 🚀 Como rodar localmente
```powershell
# Backend
cd backend
npm install
npm run dev   # escuta em http://localhost:1332 por padrão

# Frontend (novo terminal)
cd frontend
npm install
npm run dev   # abre em http://localhost:1330
```

Use `start-dev.bat` se preferir abrir tudo em paralelo automaticamente.

## 🧼 Higienização para o GitHub
- Banco `backend/data/auth.sqlite` foi removido e está ignorado via Git.
- Credenciais de exemplo usam apenas placeholders e precisam ser configuradas manualmente.
- Logs e dados específicos do cliente não foram adicionados ao repositório público.


