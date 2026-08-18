// Carrega e valida a configuração a partir do ambiente (.env).
// Regra do projeto: nada sensível hardcoded, sem números mágicos espalhados —
// todos os limites vivem aqui.
import 'dotenv/config';

/** Lê uma variável obrigatória; lança erro claro se ausente. */
function obrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor || valor.trim() === '') {
    throw new Error(`Variável de ambiente obrigatória ausente: ${nome} (veja .env.example)`);
  }
  return valor.trim();
}

/** Lê número com default; falha se vier não-numérico. */
function numero(nome, padrao) {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto.trim() === '') return padrao;
  const n = Number(bruto);
  if (Number.isNaN(n)) {
    throw new Error(`Variável ${nome} deveria ser numérica, veio: "${bruto}"`);
  }
  return n;
}

export const config = {
  anthropic: {
    apiKey: obrigatoria('ANTHROPIC_API_KEY'),
    modelo: process.env.ANTHROPIC_MODEL?.trim() || 'claude-opus-4-8',
    modeloFallback: process.env.ANTHROPIC_MODEL_FALLBACK?.trim() || 'claude-haiku-4-5',
  },
  regras: {
    confiancaMinima: numero('CONFIANCA_MINIMA', 0.85),
    retencaoDias: numero('RETENCAO_DIAS', 7),
    maxTentativasOcr: numero('MAX_TENTATIVAS_OCR', 3),
  },
  // Só dígitos — a comparação de autorização normaliza da mesma forma.
  adminWhatsapp: obrigatoria('ADMIN_WHATSAPP').replace(/\D/g, ''),
  // Segredo opcional: se vazio, a checagem de token fica desativada (dev local).
  microservicoToken: process.env.MICROSERVICO_TOKEN?.trim() || '',
  dataDir: process.env.DATA_DIR?.trim() || './data',
  porta: numero('PORT', 3000),
  logLevel: process.env.LOG_LEVEL?.trim() || 'info',
};
