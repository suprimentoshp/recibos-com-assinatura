# Recibos com Assinatura

App Web/PWA local para emitir recibos simples de pagamento com cadastro reutilizável, número sequencial automático, impressão/PDF, backup SQLite e assinatura na tela do celular.

## Requisitos

- Node.js 20 ou superior
- npm

## Como rodar

### Opção 1: sem instalar nada

Abra o arquivo `app-sem-npm.html` diretamente no navegador. Essa versão salva os dados no próprio navegador e permite imprimir/salvar PDF pela opção de impressão.

### Opção 2: versão com servidor SQLite

```bash
npm install
npm run dev
```

Depois abra:

- App: `http://localhost:5173`
- API: `http://localhost:3333/api/health`

Para usar em celular na mesma rede, abra o app pelo IP do computador em vez de `localhost`, por exemplo `http://192.168.0.10:5173`. Assim o link/QR Code de assinatura também aponta para um endereço acessível pelo celular.

## Funcionalidades

- Criação de recibo com nome, CPF formatado, data trabalhada, motivo, valor, manhãs, tardes, setor e responsável.
- Seleção de até 8 datas trabalhadas no mesmo recibo, com hora de início e hora final da jornada.
- Setores padrão: Recepção, Copa, Lumen, Governança, Lavanderia, Zeladoria e Manutenção.
- Responsáveis padrão: Walnisa, Fernando, João, Ana Paula, Jean, Felipe, Marcio e Daniel.
- Registro automático da data de emissão do recibo.
- Modo relatório separado da tela de emissão, com dashboard visual.
- Relatório com total de recibos, total lançado, assinados, ticket médio e filtros por intervalo de emissão, intervalo de dia trabalhado, setor, nome e responsável.
- Dashboard com análise por setor, responsável e nome usando os mesmos filtros do relatório.
- Acesso com login para todos os responsáveis. A senha provisória é `123456` e deve ser trocada no primeiro acesso.
- O login `Felipe` é admin e é o único com permissão para editar ou invalidar recibos.
- Recibos só podem ser editados antes de serem impressos, assinados ou cancelados.
- Recibos invalidados continuam visíveis com marca d'água `CANCELADO` e motivo do cancelamento junto da área de assinatura.
- Recibos cancelados aparecem em vermelho no relatório, mas não entram nas estatísticas, gráficos, total lançado ou ticket médio.
- Numeração automática geral no formato `000001`, `000002`, etc.
- Cadastros reaproveitados automaticamente para pessoas, setores e responsáveis.
- Busca por número, nome, motivo, setor e data.
- Pré-visualização em formato de recibo A4.
- Impressão pelo navegador e geração de PDF pelo backend.
- Assinatura eletrônica simples por canvas, com aceite, data/hora e imagem da assinatura.
- Backup do banco SQLite em `data/recibos.sqlite`.

## Observação jurídica

A assinatura coletada na tela é uma assinatura eletrônica simples. Para situações que exijam maior força probatória, a evolução recomendada é integrar assinatura GOV.BR ou certificado digital ICP-Brasil.
