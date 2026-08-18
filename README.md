# Lista de Presença — OCR de diaristas (WhatsApp → XLS)

Automação que lê **fotos de listas de presença manuscritas** enviadas pela
administradora no WhatsApp, extrai os dados com a API do Claude (visão), gera um
**XLS por turno** e devolve **XLS + foto original no privado da administradora**.

## Arquitetura (híbrida)

Escolhemos um desenho híbrido para juntar **visibilidade** e **testabilidade**:

- **n8n** faz a orquestração visível: recebe o webhook da uazapi, filtra a
  administradora, chama o microserviço e entrega XLS + foto no privado dela.
  Toda execução fica no histórico visual do n8n.
- **Microserviço Node** guarda o miolo testável e versionado: OCR com **retry
  3x + validação de schema**, geração do **XLS formatado**, armazenamento do
  original em `/data` e retenção automática.

> Justificativa (3 linhas): n8n puro colocaria ~70% da lógica crítica em Code
> nodes difíceis de testar/versionar — o que o `CLAUDE.md` proíbe. Mantendo o
> OCR/XLS num microserviço Node, temos testes automatizados e prompt versionado,
> sem perder a tela de execuções do n8n. Trocar o gateway = editar os nós HTTP.

```
uazapi (WhatsApp) ──webhook──▶ n8n
                                 │  filtra admin + baixa/normaliza mídia
                                 ▼
                    POST /processar (microserviço Node)
                       OCR (Claude) → JSON validado → XLS
                                 │  devolve xlsx_base64 + resumo
                                 ▼
              n8n envia XLS + foto original no PRIVADO da admin
```

## Estrutura

```
/src
  /ocr    extractor.js · schema.js · anthropic.client.js
  /xlsx   builder.js
  /core   config.js · logger.js · auth.js · storage.js · retention.js · errors.js · types.js
  server.js                 # Express: POST /processar, GET /health
/prompts  extracao.v1.txt   # prompt de extração versionado
/n8n      workflow.json      # fluxo importável (já importado na instância)
/data     (gitignored)       # fotos originais + XLS temporários
/tests    auth · ocr.schema · xlsx.builder · fixtures/
.env.example · Dockerfile · README.md · CLAUDE.md
```

## Contrato de saída do OCR

```json
{
  "regiao": "string",
  "data": "YYYY-MM-DD",
  "linhas": [
    {
      "nome": "string",
      "matricula_ou_cpf": "string ou null",
      "turnos": { "turno_1": true, "turno_2": false, "turno_3": false },
      "assinatura_ok": true,
      "confianca": 0.0
    }
  ],
  "observacoes": "string ou null"
}
```

Linhas com `confianca < CONFIANCA_MINIMA` recebem `precisa_revisao = true` e saem
**destacadas** no XLS.

## Colunas do XLS

Aba **Presenças**: `nome`, `matricula_ou_cpf`, `data`, `regiao`, `turno_1`,
`turno_2`, `turno_3`, `assinatura_ok`, `confianca`, `precisa_revisao`
(linhas em revisão com fundo destacado). Aba **Resumo**: totais por turno, total
de linhas e total em revisão. Nome do arquivo:
`lista_<regiao>_<data>_<timestamp>.xlsx`.

---

## Como configurar credenciais

1. Copie `.env.example` para `.env` e preencha:
   - `ANTHROPIC_API_KEY` — chave da Anthropic.
   - `ADMIN_WHATSAPP` — número autorizado (só dígitos, com DDI+DDD).
   - `MICROSERVICO_TOKEN` — segredo compartilhado com o n8n (header
     `x-microservico-token`). Deixe vazio só em dev.
   - Ajuste `CONFIANCA_MINIMA` (0.85), `RETENCAO_DIAS` (7), modelos, etc.
2. **Nunca** commite `.env` (já está no `.gitignore`).

## Como subir localmente

> ⚠️ Este repositório está numa pasta sincronizada do Google Drive
> ("Outros computadores"). O `npm install` **falha nesse mount** (EPERM/EBADF ao
> escrever `node_modules`). Rode o projeto num **disco local** (copie a pasta
> para, por ex., `C:\dev\lista-presenca`) ou dentro do container Docker.

```bash
npm install
cp .env.example .env   # e preencha
npm start              # sobe em http://localhost:3000
# saúde:
curl http://localhost:3000/health
```

### Testes

```bash
npm test
```

Cobrem: filtro de autorização, parser JSON→XLS (com amostra mock, incluindo linha
de baixa confiança destacada) e o builder do XLS (abas + resumo).

## Como subir com Docker (recomendado na infra self-hosted)

```bash
docker build -t lista-presenca-ocr .
docker run -d --name lista-presenca-ocr \
  --env-file .env \
  -p 3000:3000 \
  -v lista_presenca_data:/app/data \
  lista-presenca-ocr
```

O volume `/app/data` guarda originais + XLS (limpos automaticamente após
`RETENCAO_DIAS`). Exponha a porta 3000 apenas para o n8n (rede interna), não para
a internet.

---

## Configurar o n8n

O workflow **"Lista de Presença - OCR (uazapi + microserviço)"** já foi importado
na instância (inativo). No editor:

1. Abra o nó **Config** e preencha:
   - `microservicoUrl` — ex.: `http://microservico:3000/processar` (host/rede que
     o n8n enxerga).
   - `microservicoToken` — igual ao `MICROSERVICO_TOKEN` do `.env`.
   - `uazapiUrl` — base da sua instância uazapi.
   - `uazapiToken` — token da instância uazapi.
   - `adminPrivado` — número da administradora (só dígitos) para receber XLS+foto.
2. **Ative** o workflow e copie a URL do nó **Webhook uazapi**
   (`.../webhook/lista-presenca`).
3. Na uazapi, aponte o **webhook de mensagens recebidas** para essa URL.
4. Verifique o mapeamento (abaixo) e ative.

### Verificar o mapeamento do webhook

O nó **Normalizar** tenta vários caminhos comuns de payload da uazapi
(`message.sender`, `message.chatid`, `mediaBase64`, etc.). Como o formato varia
por versão, faça um envio de teste e confira, na execução do n8n, se
`remetente`, `grupo`, `messageType` e `imagem_base64` saíram preenchidos. Se não,
ajuste o Code do nó Normalizar para os campos da sua instância.

> Se a sua uazapi **não** envia o base64 da imagem no webhook, adicione um nó
> HTTP Request (antes do Normalizar) para baixar a mídia e coloque o base64 em
> `imagem_base64`.

### Endpoints uazapi usados

- Enviar documento (XLS) e foto: `POST {uazapiUrl}/send/media` — header `token`,
  body `{ number, type: "document"|"image", file: <base64>, docName, text }`.
- Mensagem de falha: `POST {uazapiUrl}/send/text` — body `{ number, text }`.

Confirme os nomes de campos na doc da sua versão da uazapi e ajuste os nós HTTP
se necessário.

---

## Como trocar o gateway (uazapi → outro)

O gateway vive **só nos nós HTTP do n8n** (Webhook + os 3 `send/*`). Para trocar
por Evolution API ou outro:

1. Ajuste o nó **Normalizar** ao payload do novo webhook.
2. Troque as URLs/headers/bodies dos nós de envio (`/send/media`, `/send/text`).
3. O microserviço **não muda** — ele recebe `imagem_base64` e devolve o XLS,
   independente do gateway.

## Critérios de aceite

- [x] Foto da admin gera XLS correto (abas Presenças + Resumo) — coberto por teste.
- [x] Linhas de baixa confiança destacadas no XLS — coberto por teste.
- [x] Filtro de autorização (admin passa, terceiros ignorados) — coberto por teste.
- [x] JSON malformado re-tentado até 3x antes de falhar com log claro.
- [x] Nenhuma credencial no código — tudo em `.env`.
- [ ] Teste ponta-a-ponta real (webhook uazapi → privado) — depende de preencher
      o nó Config e apontar o webhook da uazapi (passos acima).

## Segurança

- Só o número em `ADMIN_WHATSAPP` é processado; o resto é ignorado (só log).
- A foto original é salva **antes** do OCR e sempre reenviada (fonte da verdade).
- Rotacione a **API key do n8n** usada para importar o workflow (ela foi exposta
  no chat de setup).
