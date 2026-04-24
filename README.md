# 🔊 ECHON — Sistema de Monitoramento de Ruído e Stress Acústico

<p align="center">
  <img src="echon-dashboard/Logo_W.png" alt="ECHON Logo" width="160"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-em%20desenvolvimento-yellow?style=flat-square" />
  <img src="https://img.shields.io/badge/versão-1.0.0-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/licença-privado-red?style=flat-square" />
  <img src="https://img.shields.io/badge/stack-Node.js%20%7C%20MySQL%20%7C%20HTML-informational?style=flat-square" />
</p>

---

## 📌 Sobre o projeto

O **ECHON** é uma plataforma inteligente de monitoramento acústico desenvolvida para ambientes corporativos, educacionais e institucionais. Utilizando sensores **ESP32 + microfone MEMS INMP441**, o sistema captura níveis de ruído em tempo real e os exibe em um dashboard interativo e personalizado por cliente.

> Ruído excessivo afeta concentração, saúde e produtividade. O ECHON transforma dados acústicos em decisões inteligentes.

---

## 🖼️ Preview

| Tela de Login | Dashboard |
|---|---|
| Tela de acesso com área admin oculta | Painel com métricas, gráficos e alertas em tempo real |

---

## 🚀 Funcionalidades

- ✅ Login seguro por cliente com JWT
- ✅ Dashboard personalizado com nome e dados do contratante
- ✅ Monitoramento de ruído em tempo real (dB)
- ✅ Gráfico histórico de medições
- ✅ Alertas automáticos por nível de ruído (baixo, moderado, alto)
- ✅ Histórico de medições por dia com mini gráficos
- ✅ Exportação de dados em CSV
- ✅ Área administrativa oculta para cadastro de clientes e sensores
- ✅ Geração automática de token para cada sensor ESP32
- ✅ Dicas de conforto acústico integradas ao painel
- ✅ Design responsivo (desktop e mobile)

---

## 🗂️ Estrutura do repositório

```
echon-sistema/
│
├── 📁 echon-api/          # Backend Node.js
│   ├── server.js          # API REST principal
│   ├── package.json       # Dependências
│   ├── .gitignore         # Arquivos ignorados pelo Git
│   └── .env               # ⚠️ NÃO versionado — credenciais locais
│
├── 📁 echon-dashboard/    # Frontend (HTML/CSS/JS)
│   ├── index.html         # Tela de login + área admin
│   ├── dashboard.html     # Painel principal do cliente
│   └── Logo_W.png         # Logo do sistema
│
└── 📁 banco/
    └── schema.sql         # Estrutura do banco de dados
```

---

## 🛠️ Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript puro |
| Gráficos | Chart.js |
| Backend | Node.js + Express |
| Banco de dados | MySQL |
| Autenticação | JWT (JSON Web Token) |
| Hardware | ESP32 + MEMS INMP441 |
| Hospedagem API | Render.com |
| Hospedagem Frontend | GitHub Pages |

---

## ⚙️ Como rodar localmente

### Pré-requisitos

- [Node.js](https://nodejs.org) instalado
- Acesso ao banco MySQL configurado
- VS Code com extensão Live Server

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/echon-sistema.git
cd echon-sistema
```

### 2. Configure as variáveis de ambiente

Dentro da pasta `echon-api`, crie um arquivo `.env`:

```env
DB_HOST=seu_host
DB_USER=seu_usuario
DB_PASS=sua_senha
DB_NAME=nome_do_banco
DB_PORT=3306
JWT_SECRET=echon-super-secret-2025
PORT=3000
```

### 3. Instale as dependências e rode a API

```bash
cd echon-api
npm install
node server.js
```

A API estará disponível em `http://localhost:3000`

### 4. Abra o frontend

No VS Code, clique com o botão direito em `echon-dashboard/index.html` e selecione **"Open with Live Server"**.

---

## 🗄️ Banco de dados

O arquivo `banco/schema.sql` contém a estrutura completa das tabelas:

| Tabela | Descrição |
|---|---|
| `clientes` | Contratantes com acesso ao dashboard |
| `dispositivos` | Sensores ESP32 vinculados a cada cliente |
| `medicoes` | Leituras de dB enviadas pelos sensores |
| `alertas` | Eventos de ruído fora dos limites configurados |

---

## 📡 Endpoints da API

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| `POST` | `/api/login` | Login do cliente | ❌ |
| `GET` | `/api/dashboard` | Dados do dashboard | ✅ JWT |
| `POST` | `/api/medicao` | Receber dados do ESP32 | Token do sensor |
| `POST` | `/api/admin/cadastrar` | Cadastrar cliente + sensor | Senha admin |

---

## 🔌 Integração com ESP32

Quando o circuito estiver pronto, o ESP32 deve enviar requisições `POST` para `/api/medicao` com o seguinte payload:

```json
{
  "token": "echon-abc123xyz",
  "db_valor": 58.3
}
```

O token é gerado automaticamente no cadastro do cliente pela área admin.

---

## 📊 Níveis de ruído monitorados

| Nível | Faixa | Indicador |
|---|---|---|
| 🟢 Baixo | Abaixo de 60 dB | Verde |
| 🟡 Moderado | 60 – 79 dB | Amarelo |
| 🔴 Alto | 80 dB ou mais | Vermelho |

> A OMS recomenda ambientes de trabalho abaixo de **65 dB** para preservação da saúde auditiva.

---

## 🔐 Segurança

- Senhas armazenadas no banco (criptografia planejada para v1.1)
- Autenticação via JWT com expiração de 8h
- Área administrativa protegida por senha única
- Credenciais do banco nunca versionadas (`.env` no `.gitignore`)

---

## 📅 Roadmap

- [x] Sistema de login por cliente
- [x] Dashboard com dados em tempo real
- [x] Histórico de medições
- [x] Exportação CSV
- [x] Cadastro de clientes via painel admin
- [ ] Criptografia de senhas (bcrypt)
- [ ] Troca de senha pelo perfil
- [ ] Integração completa com ESP32
- [ ] Notificações por e-mail
- [ ] App mobile
- [ ] Relatórios em PDF

---

## 👨‍💻 Desenvolvido por

**Projeto ECHON – Sonara**  
Desenvolvido como projeto integrador de Engenharia.

---

<p align="center">
  © 2026 ECHON – Sonara · Todos os direitos reservados
</p>
