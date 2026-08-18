// Baixa uma imagem por URL (a uazapi entrega a mídia descriptografada num
// fileURL público). Usado quando o n8n manda `imagem_url` em vez de base64.
import { ErroApp } from './errors.js';

const MAX_BYTES = 20 * 1024 * 1024; // teto de 20 MB

/**
 * @param {string} url
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ base64: string, mime: string }>}
 */
export async function baixarImagem(url, { timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) {
      throw new ErroApp(`download da mídia falhou (HTTP ${r.status})`, {
        codigo: 'midia_download',
        status: 502,
        mensagemAdmin: 'Não consegui baixar a imagem enviada. Tente reenviar a foto.',
      });
    }
    const buffer = Buffer.from(await r.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      throw new ErroApp('mídia excede o tamanho máximo', {
        codigo: 'midia_grande',
        status: 413,
        mensagemAdmin: 'A imagem é muito grande. Envie uma foto um pouco menor.',
      });
    }
    const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    return { base64: buffer.toString('base64'), mime };
  } catch (err) {
    if (err instanceof ErroApp) throw err;
    throw new ErroApp(`erro ao baixar mídia: ${err.message}`, {
      codigo: 'midia_download',
      status: 502,
      mensagemAdmin: 'Não consegui baixar a imagem enviada. Tente reenviar a foto.',
    });
  } finally {
    clearTimeout(timer);
  }
}
