# Central · ID - Visão Técnica

Este documento explica como funciona a integração com os relógios Control iD sem presumir experiência prévia com ferramentas JavaScript. Ele descreve as tecnologias em linguagem direta, o layout do repositório, as rotinas diárias e os problemas mais comuns — agora em português.

---

## 1. Resumo Rápido
- Dois projetos TypeScript vivem lado a lado:
  - `backend/`: API Node.js + Express que conversa com os relógios Control iD via comandos cURL, guarda usuários em um arquivo SQLite (`sql.js`) e expõe rotas REST na porta **1332**.
  - `frontend/`: SPA React compilada pelo Vite. Consome a API, aplica as roles (Admin/Padrão) e roda na porta **1330** em desenvolvimento.
- A autenticação usa JSON Web Tokens (JWT) guardados em cookie HTTP-only. O backend sempre cria dois administradores seed para garantir acesso inicial.
- O script `start-dev.bat` sobe ambos os apps em Windows. Em produção, o backend roda como serviço Node (Agendador de Tarefas/PM2) e o frontend compilado é servido por IIS ou qualquer servidor de arquivos estáticos.

---

## 2. Fluxo End-to-End
1. O usuário abre o app React (servido pelo Vite em dev ou por IIS/arquivos estáticos em produção).
2. O app chama `POST /api/auth/login`. O backend valida as credenciais no SQLite e devolve um cookie JWT.
3. As requisições autenticadas (dashboard, sincronização de colaboradores etc.) já levam o cookie automaticamente (`credentials: "include"`).
4. Quando o dashboard precisa de dados dos relógios, o backend executa cURL, mantém cache da sessão e traduz o retorno para JSON.
5. Ações administrativas (`/api/admin/*`) só aceitam JWTs com role `admin`.

---

## 3. Tecnologias em Linguagem Simples
| Termo | Significado aqui |
| --- | --- |
| **Node.js** | Runtime que executa JavaScript fora do navegador (pense em um serviço console, só que em JS). Necessário para o backend e para as ferramentas de build. |
| **TypeScript** | JavaScript com tipagem estática similar ao C#. É o código-fonte padrão dos dois projetos e compila para JavaScript puro. |
| **Express** | Microframework HTTP para Node. Faz o papel do roteador e middlewares, similar ao ASP.NET Web API. |
| **React** | Biblioteca de componentes para construir interfaces. A aplicação inteira vive em uma única página que React atualiza dinamicamente, com navegação via React Router. |
| **Vite** | Servidor de desenvolvimento e empacotador moderno. Dá hot reload em `npm run dev` e gera build otimizado com `npm run build`. |
| **SQLite + sql.js** | Banco SQLite compilado para WebAssembly, rodando totalmente em memória, mas persistindo no arquivo `backend/data/auth.sqlite`. Não há SGBD externo. |
| **JWT (JSON Web Token)** | Token assinado contendo id/role do usuário, armazenado em cookie para o navegador enviar sozinho a cada requisição. |
| **Tailwind** | Framework CSS utilitário. Em vez de classes semânticas, usa combinações curtas (`bg-green-500`, `flex`, etc.). |

---

## 4. Estrutura do Repositório
```
root
├─ backend/
│  ├─ src/
│  │  ├─ server.ts              # Entrada Express + registro de rotas
│  │  ├─ auth/                  # Login, JWT helpers, rotas admin
│  │  ├─ services/ + clocks.ts  # Integrações Control iD e catálogo
│  │  └─ types/utils            # Helpers compartilhados
│  ├─ data/auth.sqlite          # Arquivo SQLite (criado no primeiro run)
│  ├─ dist/                     # JS compilado após `npm run build`
│  └─ package.json / tsconfig.json
├─ frontend/
│  ├─ src/
│  │  ├─ App.tsx / main.tsx     # Entradas React
│  │  ├─ contexts/AuthContext   # Gestão de sessão
│  │  ├─ pages/dashboard/*      # Dashboard, Admin, telas Control iD
│  │  └─ components/            # Componentes compartilhados
│  ├─ vite.config.ts            # Porta 1330, host 0.0.0.0, allowed hosts
│  ├─ dist/                     # Build de produção (`npm run build`)
│  └─ package.json / tsconfig.json
├─ start-dev.bat                # Sobe backend + frontend em dev
└─ TECHNICAL_OVERVIEW.md        # Este documento
```

---

## 5. Backend (`backend/`)
### Execução
- Requer Node.js 18+ e `curl.exe` (já incluso no Windows moderno).
- `npm run dev` roda `tsx watch src/server.ts` com hot reload.
- `npm run build` gera `dist/`; `npm run start` executa `node dist/server.js`.

### Variáveis de Ambiente
| Variável | Finalidade | Default |
| --- | --- | --- |
| `PORT` | Porta HTTP da API | `1332` |
| `AUTH_DB_PATH` | Caminho do SQLite (relativo ou absoluto) | `data/auth.sqlite` |
| `AUTH_JWT_SECRET` | Segredo usado para assinar os JWTs | `change-me` |
| `AUTH_DEFAULT_ADMIN_LOGIN/PASSWORD` | Credenciais seed principal | definir via `.env` |
| `AUTH_SECOND_ADMIN_LOGIN/PASSWORD` | Seed secundária | definir via `.env` |
| `CONTROL_ID_LOGIN/PASSWORD` | Usuário dos relógios | definir via `.env` |
| `BRTA_MASTER_IP` | IP padrão usado para o relógio mestre BRTA | `192.168.100.10` |
| `BRGO_MASTER_IP` | IP padrão usado para o relógio mestre BRGO | `192.168.200.10` |
| `CONTROL_ID_MAX_ATTEMPTS`, `CONTROL_ID_CURL_TIMEOUT_MS`, `SESSION_TTL`, `CURL_BINARY`, etc. | Ajustes finos da integração cURL; altere apenas se estiver depurando lentidão/timeouts. |

### Autenticação & Roles
- Senhas são armazenadas com hash `bcryptjs`.
- O payload do JWT contém `userId`, `login`, `role`, flag `active` e expiração.
- Middleware `requireRole('admin')` protege rotas administrativas; demais usam apenas `isAuthenticated`.
- A migração do banco converte automaticamente roles antigas (`rh`, `ti`) para `admin`/`padrao`.

### Integração Control iD
- Cada relógio fica descrito em `src/clocks.ts` (ID, planta, IP, recursos).
- O backend autentica via cURL, mantém a sessão viva por `SESSION_TTL` segundos e tenta novamente até `CONTROL_ID_MAX_ATTEMPTS`.
- As rotas estão agrupadas em `/api/brta/*` (Tanabi) e `/api/brgo/*` (Goiânia); o frontend segue a mesma divisão.

### Armazenamento
- `sql.js` mantém o banco em memória durante a execução e grava no arquivo sempre que há alteração.
- Se o processo não puder escrever no caminho configurado, o login falha por falta de tabela. Conceda permissão de Modificar à conta que executa o serviço ou mova o arquivo e atualize `AUTH_DB_PATH`.

---

## 6. Frontend (`frontend/`)
### Execução
- `npm run dev` inicia o Vite na porta **1330** com hot reload.
- `npm run build` usa TypeScript + Vite para gerar arquivos estáticos em `dist/`.
- `npm run preview` serve o build localmente (simula produção).

### Configuração
- `vite.config.ts` faz bind em `0.0.0.0` e libera o host `example-host.local` para testes na rede.
- Variáveis opcionais em `.env` precisam começar com `VITE_`:
  - `VITE_BACKEND_URL`: URL absoluta da API (ex.: `https://central.exemplo.com/api`). Se ausente, o app monta automaticamente usando o host do navegador + `VITE_BACKEND_PORT`.
  - `VITE_BACKEND_PORT`: porta fallback da API. Default `1332`.
- `src/lib/api.ts` concentra a lógica do endpoint base; ajuste ali caso a topologia mude.

### Componentes-chave
- `AuthContext` guarda o usuário atual, faz login/logout e atualiza o perfil via `/api/auth/me`.
- `DashboardLayout` combina sidebar, cabeçalho e área das rotas.
- `pages/dashboard/admin/Users.tsx` fornece a UI de gestão multi-admin (criar, ativar/desativar, trocar role, resetar senha, excluir).
- `pages/dashboard/brta/*` e `pages/dashboard/brgo/*` cuidam dos colaboradores sincronizados com cada planta.

---

## 7. Trabalho Local
1. **Clone o repositório em um caminho local** (evite UNC tipo `\\servidor\pastas`, pois o npm falha nesses cenários).
2. **Instale as dependências**:
   ```powershell
   cd backend; npm ci
   cd ..\frontend; npm ci
   ```
3. **Suba as duas aplicações** com `start-dev.bat` ou manualmente:
   ```powershell
   # Terminal 1
   cd backend; set PORT=1332; npm run dev

   # Terminal 2
   cd frontend; npm run dev
   ```
4. Abra `http://localhost:1330`. O frontend chamará `http://localhost:1332`.
5. Faça login com um administrador seed e, em seguida, crie novos admins ou altere senhas pela tela Admin → Usuários.

---

## 8. Build e Deploy
### Backend
- Rode `npm run build` para gerar `backend/dist/`.
- Copie `backend/` (incluindo `dist/`, `package*.json`, `.env` e a pasta `data/`) para o servidor.
- Garanta permissão de leitura/escrita no caminho configurado em `AUTH_DB_PATH`.
- Inicie com `node dist/server.js` (ou `npm run start`). Para execução contínua:
  1. Crie uma tarefa do Agendador configurada para iniciar `node` no boot.
  2. Ou instale PM2 (`npm install -g pm2`) e rode `pm2 start dist/server.js --name central-id`.
- Libere a porta 1332 (ou a porta customizada) no firewall ou coloque o serviço atrás de um proxy IIS/NGINX.

### Frontend
- `npm run build` produz arquivos em `frontend/dist/`.
- Hospede-os no IIS, Nginx, Apache ou qualquer storage estático (S3, Azure Storage etc.). Configure resposta padrão `index.html` para todas as rotas (fallback do React Router).
- Caso queira servir via backend, copie `dist/` para algo como `backend/public/` e adicione `app.use(express.static('public'))` + rota coringa no `server.ts`.

---

## 9. Operação & Manutenção
- **Logs**: o backend escreve em stdout. Capture via Agendador, PM2 ou outra camada de serviço. A maioria dos erros inclui rota e stack trace.
- **Reset de senha admin**:
  1. Pare o processo do backend.
  2. Apague `backend/data/auth.sqlite` (ou faça backup).
  3. Suba o backend novamente para recriar o banco e os seeds.
  4. Faça login e atualize as senhas imediatamente.
- **Adicionar novos relógios**: edite `backend/src/clocks.ts` com ID/IP/planta e reinicie o backend.
- **HTTPS**: atualmente tratado pelo proxy (IIS/Nginx). Se expor o backend diretamente, termine TLS nesse proxy.

---

## 10. Guia de Troubleshooting
| Sintoma | Causa provável | Como resolver |
| --- | --- | --- |
| `EPERM: operation not permitted, unlink ... node_modules/.vite` ao rodar o front | Cache do Vite travado por outro processo ou antivírus | Feche instâncias do Vite, delete `frontend\node_modules\.vite`, rode `npm run dev` novamente. Adicione exceção no antivírus se persistir. |
| `npm ERR! code ENOENT ... lstat '\\servidor\...'` | Instalação em caminho de rede/UNC | Clone para unidade local (ex.: `D:\gestaoRH`). Ferramentas Node não são estáveis em UNC. |
| Logs do backend mostram `SQLITE_CANTOPEN` ou `permission denied` | Conta Windows sem permissão de escrita em `backend\data` | Conceda permissão Modificar ou ajuste `AUTH_DB_PATH` para uma pasta acessível. |
| Login funciona mas telas admin retornam 401 | Cookie bloqueado ou frontend servido de host diferente sem apontar a API correta | Garanta que front e back usem o mesmo host/domínio ou configure `VITE_BACKEND_URL`. Verifique também `CORS_ALLOWED_ORIGINS`. |
| `spawn curl ENOENT` ao acessar Control iD | `curl.exe` fora do PATH (Windows antigo) | Instale o curl ou defina `CURL_BINARY="C:\\Windows\\System32\\curl.exe"` no `.env` do backend. |
| Requisições Control iD expiram | Dispositivo offline, IP incorreto ou firewall bloqueando | Faça ping no IP, valide `CONTROL_ID_LOGIN/PASSWORD`, confirme portas liberadas entre servidor e relógios. |
| `ERR_CONNECTION_REFUSED` ao acessar de outra máquina | Porta 1330/1332 bloqueada ou Vite ouvindo só em localhost | Mantenha `host: '0.0.0.0'` no Vite e abra as portas no firewall. Em produção, sirva via IIS/NGINX em portas padrão. |

---

## 11. Comandos de Referência
```powershell
# Backend
cd backend
npm run dev        # modo watch
npm run build      # compila para dist/
npm run start      # executa o build

# Frontend
cd frontend
npm run dev
npm run build
npm run preview

# Lint / Type Check (opcionais)
npm run lint
npm run typecheck
```




