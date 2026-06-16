# Recibos com Assinatura

App Web/PWA para emitir recibos de pagamento com login, histórico, relatórios, impressão, assinatura na tela e numeração automática.

## Requisitos

- Node.js 20 ou superior
- npm
- PostgreSQL para uso online/produção

## Como rodar localmente

```bash
npm install
npm start
```

Depois abra:

- App: `http://localhost:3333`
- Saúde da API: `http://localhost:3333/api/health`

## Histórico e banco de dados

A versão atual usa uma camada híbrida:

- Se `DATABASE_URL` estiver configurado, o backend usa PostgreSQL como fonte definitiva do histórico.
- Se `DATABASE_URL` não estiver configurado, o backend usa JSON como fallback temporário.
- Mesmo usando PostgreSQL, o servidor mantém um snapshot JSON local como backup de emergência.

Para uso online no Render, configure um banco PostgreSQL e vincule a variável `DATABASE_URL` ao Web Service.

O endpoint `/api/health` mostra o modo atual em `storage.mode`:

- `postgres`: correto para produção online.
- `json`: fallback temporário; não é o ideal para vários usuários.

## Auditoria

O backend registra eventos permanentes em `receipt_events` quando recebe alterações pelo `/api/app-data` ou `/api/sync`:

- recibo criado
- recibo editado
- recibo cancelado
- recibo impresso
- recibo assinado

Cada evento guarda o número do recibo, usuário quando disponível, data/hora e snapshot dos dados recebidos.

## Configuração PostgreSQL

Use `server/.env.example` como referência:

```env
PORT=3333
DATABASE_URL=postgres://usuario:senha@host:5432/banco
DATA_DIR=./data
```

O schema é criado automaticamente na primeira inicialização. Uma cópia está em `server/schema.sql`.

## Uso local em servidor interno

Execute apenas uma instância do app no computador servidor. Os demais computadores devem acessar pelo navegador:

```text
http://NOME-OU-IP-DO-SERVIDOR:3333
```

Não execute o `.exe` em cada computador, pois isso cria históricos separados.

## Funcionalidades principais

- Login para responsáveis.
- Felipe como administrador.
- Recibo simples e recibo em lote.
- Numeração automática iniciando em `100400`.
- Setores padrão: Recepção, Copa, Lumen, Governança e Manutenção.
- CPF com máscara brasileira.
- Histórico e relatório com filtros.
- Impressão de recibos e lista de recibos selecionados.
- Cancelamento com motivo e marca d'água.
- Assinatura digital desenhada na tela.
- Backup JSON manual e snapshot automático.

## Observação jurídica

A assinatura coletada na tela é uma assinatura eletrônica simples. Para situações que exijam maior força probatória, a evolução recomendada é integrar assinatura GOV.BR ou certificado digital ICP-Brasil.
