// Orquestra a extração: prompt versionado -> Claude -> JSON válido -> enriquecido.
// Regras do projeto:
//  - JSON malformado => re-tenta até MAX_TENTATIVAS_OCR; se persistir, ErroApp.
//  - Fallback de modelo em erro de API.
//  - Cada linha ganha `precisa_revisao` se confianca < CONFIANCA_MINIMA.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { ErroApp } from '../core/errors.js';
import { validar } from './schema.js';
import { extrairTexto as extrairTextoPadrao } from './anthropic.client.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const CAMINHO_PROMPT = path.resolve(aqui, '../../prompts/extracao.v1.txt');

let promptCache = null;
async function carregarPrompt() {
  if (promptCache === null) {
    promptCache = await readFile(CAMINHO_PROMPT, 'utf-8');
  }
  return promptCache;
}

/** Extrai o JSON de uma resposta textual, tolerando cercas ```json. */
export function extrairJson(texto) {
  if (!texto) throw new Error('resposta vazia do modelo');
  let limpo = texto.trim();
  // Remove cercas de código, se houver.
  const fence = limpo.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) limpo = fence[1].trim();
  // Recorta do primeiro { ao último } para descartar preâmbulos.
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini === -1 || fim === -1 || fim < ini) {
    throw new Error('nenhum objeto JSON encontrado na resposta');
  }
  return JSON.parse(limpo.slice(ini, fim + 1));
}

/** Marca precisa_revisao por linha conforme o limite de confiança. */
export function enriquecer(lista, confiancaMinima = config.regras.confiancaMinima) {
  return {
    ...lista,
    linhas: lista.linhas.map((linha) => ({
      ...linha,
      precisa_revisao: linha.confianca < confiancaMinima,
    })),
  };
}

/**
 * Executa a extração completa a partir da imagem.
 * @param {object} p
 * @param {string} p.imagemBase64
 * @param {string} [p.mime='image/jpeg']
 * @param {object} [deps] injeção p/ testes: { extrairTexto }
 * @returns {Promise<import('../core/types.js').ListaExtraida>}
 */
export async function extrairDaImagem(
  { imagemBase64, mime = 'image/jpeg' },
  deps = {},
) {
  const extrairTexto = deps.extrairTexto || extrairTextoPadrao;
  const prompt = await carregarPrompt();
  const maxTentativas = Math.max(1, config.regras.maxTentativasOcr);

  let ultimoErro;
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    // Na primeira tentativa usa o modelo principal; nas seguintes, se a falha
    // foi de API, cai para o fallback.
    const usarFallback = tentativa > 1 && ultimoErro?.tipo === 'api';
    const modelo = usarFallback ? config.anthropic.modeloFallback : config.anthropic.modelo;

    let texto;
    try {
      texto = await extrairTexto({ imagemBase64, mime, prompt, modelo });
    } catch (err) {
      ultimoErro = { tipo: 'api', mensagem: err.message };
      logger.warn({ tentativa, modelo, erro: err.message }, 'falha de API na extração');
      continue;
    }

    let bruto;
    try {
      bruto = extrairJson(texto);
    } catch (err) {
      ultimoErro = { tipo: 'parse', mensagem: err.message };
      logger.warn({ tentativa, erro: err.message }, 'JSON malformado do modelo');
      continue;
    }

    const val = validar(bruto);
    if (!val.ok) {
      ultimoErro = { tipo: 'schema', mensagem: val.erros };
      logger.warn({ tentativa, erros: val.erros }, 'JSON fora do schema do contrato');
      continue;
    }

    logger.info(
      { tentativa, linhas: val.data.linhas.length, regiao: val.data.regiao },
      'extração concluída',
    );
    return enriquecer(val.data);
  }

  throw new ErroApp(
    `extração falhou após ${maxTentativas} tentativas (${ultimoErro?.tipo}: ${ultimoErro?.mensagem})`,
    {
      codigo: `ocr_${ultimoErro?.tipo || 'desconhecido'}`,
      mensagemAdmin:
        'Não consegui ler a lista. Reenvie a foto mais nítida e bem enquadrada, por favor.',
      status: 422,
    },
  );
}
