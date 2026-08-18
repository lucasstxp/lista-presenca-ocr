# Prompt para o Claude Code

> Cole o bloco abaixo no Claude Code. Ele descreve o projeto completo, a stack, o fluxo e os critérios de aceite. Ajuste os valores marcados com `<< >>` antes de rodar.

---

## Contexto do projeto

Preciso que você construa a estrutura completa de um sistema de automação para **processamento de listas de presença de diaristas** de uma transportadora, integrado ao WhatsApp.

### Fluxo de negócio (o que o sistema faz)

1. Existe um **grupo de WhatsApp** com o bot e uma **administradora**.
2. A administradora envia **fotos das listas de presença** (assinadas à mão pelos diaristas) nesse grupo.
3. O bot detecta a foto, faz **OCR + extração estruturada** usando a **API do Claude (visão)**.
4. O bot gera um **arquivo XLS** com os dados extraídos, separados por **turno (1, 2 e 3)**.
5. O bot devolve, **no privado da administradora** (não no grupo), dois itens:
   - o **XLS gerado**;
   - a **foto original** que ela enviou (para conferência lado a lado).

### Regras críticas

- O bot só deve processar **imagens enviadas pela administradora autorizada**. Qualquer outra mensagem/remetente no grupo deve ser **ignorada**.
- As listas são **manuscritas** — nenhum OCR acerta 100%. Cada linha extraída precisa de um campo `confianca` (0 a 1). Linhas com confiança abaixo do limite (`<< CONFIANCA_MINIMA = 0.85 >>`) devem sair **destacadas** no XLS para revisão manual.
- A saída da extração deve ser **JSON estruturado** (não texto livre), depois convertido em XLS.
- Precisa haver **log/trilha** de cada processamento (data, remetente, arquivo gerado, nº de linhas, nº de linhas em revisão).

---

## Stack técnica

- **Gateway WhatsApp:** `<< Evolution API (self-hosted) | uazapi (gerenciado) >>` — escolha e implemente um. Se Evolution, incluir docker-compose.
- **Orquestração:** n8n (workflow importável em JSON) **OU** um serviço Node.js/Python próprio, o que você julgar mais robusto e manutenível. Justifique a escolha em 3 linhas no README.
- **OCR / extração:** API do Claude (Anthropic) com visão. Modelo: `claude-opus-4-8` para máxima precisão, com fallback configurável para um modelo mais barato.
- **Geração de XLS:** biblioteca apropriada (ex.: `exceljs` no Node ou `openpyxl` no Python).
- **Armazenamento temporário:** imagens e XLS gerados em `/data`, com limpeza automática após `<< 7 dias >>`.

Todas as credenciais devem vir de variáveis de ambiente (`.env`), nunca hardcoded. Gere um `.env.example`.

---

## O que você deve entregar

1. **Estrutura de pastas** organizada e documentada.
2. **Integração com o gateway WhatsApp** escolhido: receber webhook de mensagem, baixar mídia, identificar remetente, enviar mensagem/arquivo no privado.
3. **Módulo de OCR/extração** com o Claude:
   - Prompt de extração dedicado (arquivo separado, versionável).
   - Retorno em JSON validado por schema (rejeitar/re-tentar se o JSON vier malformado).
   - Campo `confianca` por linha.
4. **Módulo de geração de XLS**:
   - Colunas: `nome`, `matricula_ou_cpf`, `data`, `regiao`, `turno_1`, `turno_2`, `turno_3`, `assinatura_ok`, `confianca`, `precisa_revisao`.
   - Linhas com `precisa_revisao = true` destacadas (fundo colorido).
   - Uma aba de resumo (total por turno, total em revisão).
5. **Filtro de autorização** por número da administradora.
6. **Entrega no privado** (XLS + foto original).
7. **Logs** estruturados.
8. **README.md** com: como configurar credenciais, como subir, como testar localmente, como trocar o gateway.
9. **CLAUDE.md** (se eu não fornecer um) na raiz, com convenções do projeto.
10. **Testes**: pelo menos um teste do parser de JSON→XLS com uma amostra mock, e um teste do filtro de autorização.

---

## Schema de saída esperado do OCR (contrato)

O prompt de extração do Claude deve produzir exatamente esta estrutura:

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

---

## Critérios de aceite

- [ ] Enviar uma foto de teste no grupo (como a admin) gera um XLS correto no privado dela, junto com a foto.
- [ ] Foto enviada por outra pessoa no grupo é ignorada.
- [ ] JSON malformado do modelo é re-tentado automaticamente (máx. 3x) antes de falhar com log claro.
- [ ] Linhas de baixa confiança aparecem destacadas no XLS.
- [ ] Nenhuma credencial no código; tudo em `.env`.
- [ ] `README.md` permite que outra pessoa suba o projeto do zero.

---

## Forma de trabalhar

1. Primeiro, proponha a **estrutura de pastas e a escolha da stack** (gateway + orquestração) e aguarde meu OK.
2. Depois implemente por módulos, na ordem: gateway → OCR → XLS → entrega → logs → testes.
3. Ao final, gere um passo a passo de deploy.

Comece pela proposta de arquitetura.
