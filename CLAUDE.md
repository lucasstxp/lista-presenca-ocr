# CLAUDE.md

Guia de comportamento e convenções para o Claude Code neste repositório.

## Sobre o projeto

Automação de processamento de **listas de presença de diaristas** (transportadora) via WhatsApp.
Fluxo: administradora envia foto da lista em um grupo → bot faz OCR/extração com a API do Claude → gera XLS por turno → devolve XLS + foto original **no privado da administradora**.

## Princípios

- **Simplicidade primeiro.** Prefira a solução mais direta que atenda ao requisito. Não adicione abstrações, filas ou microserviços sem necessidade comprovada.
- **Falhar de forma clara.** Todo erro deve gerar log legível e, quando afetar a admin, uma mensagem amigável no privado dela ("não consegui ler a lista, reenvie a foto mais nítida").
- **Nunca perder o original.** A foto enviada é a fonte da verdade; sempre a armazene e a devolva junto com o XLS.
- **Humano no loop.** O sistema não paga ninguém. Ele extrai e organiza; a validação final é humana. Linhas duvidosas devem ser sinalizadas, nunca "chutadas".

## Segurança e credenciais

- **Nunca** faça commit de credenciais, tokens, número de telefone real ou chaves de API.
- Tudo sensível vem de `.env`. Mantenha o `.env.example` atualizado a cada nova variável.
- Só processe mídias do **número autorizado da administradora** (variável `ADMIN_WHATSAPP`). Rejeite o resto silenciosamente (apenas log).
- Não envie dados de diaristas para nenhum serviço além do necessário (gateway WhatsApp + API do Claude).

## Convenções de código

- Linguagem: `<< Node.js LTS | Python 3.12 >>` (fixe uma e mantenha).
- Nomes de variáveis e commits em português ou inglês — escolha um padrão e mantenha em todo o repo.
- Funções pequenas e com responsabilidade única. Um módulo por etapa do fluxo: `gateway/`, `ocr/`, `xlsx/`, `delivery/`, `core/`.
- Sem números mágicos: limites (confiança mínima, retries, dias de retenção) ficam em config.
- Comente **o porquê**, não o óbvio.

## Estrutura esperada

```
/src
  /gateway     # integração WhatsApp (webhook, download de mídia, envio)
  /ocr         # chamada ao Claude + validação de schema
  /xlsx        # geração e formatação do XLS
  /delivery    # envio de XLS + foto no privado da admin
  /core        # config, logger, autorização, tipos/schemas
/prompts       # prompt de extração versionado (texto)
/data          # imagens e XLS temporários (gitignored)
/tests
.env.example
README.md
CLAUDE.md
```

## OCR / extração (regras)

- O prompt de extração vive em `/prompts` como arquivo separado e versionado — não hardcode dentro da lógica.
- A resposta do Claude **deve** ser JSON válido no schema do contrato. Se não for: re-tente até 3x; se persistir, avise a admin e registre log.
- Cada linha carrega `confianca` (0–1). Abaixo de `CONFIANCA_MINIMA` → `precisa_revisao = true`.
- Separe presença por **turno 1, 2 e 3** em colunas distintas.
- Nunca invente dados. Campo ilegível = `null` + baixa confiança, não uma adivinhação.

## XLS (regras)

- Colunas fixas conforme contrato do projeto.
- Linhas `precisa_revisao = true` destacadas com cor de fundo.
- Aba de resumo: totais por turno e total em revisão.
- Nome do arquivo: `lista_<regiao>_<data>_<timestamp>.xlsx`.

## Testes

- Antes de finalizar qualquer módulo, garanta que os testes existentes passam.
- Cubra no mínimo: parser JSON→XLS (com mock) e filtro de autorização.
- Use uma imagem de amostra fictícia para testes de ponta a ponta; nunca uma lista real com dados de pessoas.

## Ao trabalhar

- Antes de grandes mudanças estruturais, proponha e aguarde OK.
- Ao terminar uma tarefa, resuma o que mudou e o que falta.
- Mantenha o `README.md` sincronizado com o estado real do projeto.
- Não marque um critério de aceite como pronto sem ter testado o caminho real.

## Fora de escopo (não fazer sem pedir)

- Executar pagamentos ou integrar com sistema financeiro.
- Deletar permanentemente dados de diaristas.
- Enviar mensagens em massa ou para números não autorizados.
- Armazenar dados de diaristas fora de `/data` sem combinar antes.
