// Wrapper fino do SDK da Anthropic (visão). Isola a chamada de rede para
// facilitar teste/mocking do extractor.
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../core/config.js';

const cliente = new Anthropic({ apiKey: config.anthropic.apiKey });

/**
 * Envia a imagem + prompt ao modelo de visão e devolve o TEXTO da resposta.
 * @param {object} p
 * @param {string} p.imagemBase64
 * @param {string} p.mime            ex.: 'image/jpeg'
 * @param {string} p.prompt          instrução de extração (de /prompts)
 * @param {string} p.modelo          id do modelo
 * @returns {Promise<string>} texto concatenado dos blocos de texto
 */
export async function extrairTexto({ imagemBase64, mime, prompt, modelo }) {
  const resposta = await cliente.messages.create({
    model: modelo,
    max_tokens: 16000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mime, data: imagemBase64 },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  return resposta.content
    .filter((bloco) => bloco.type === 'text')
    .map((bloco) => bloco.text)
    .join('')
    .trim();
}
