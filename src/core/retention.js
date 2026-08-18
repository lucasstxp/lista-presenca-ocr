// Limpeza automática de /data: remove arquivos mais velhos que RETENCAO_DIAS.
// Roda periodicamente (agendado no server.js).
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { logger } from './logger.js';
import { garantirDataDir } from './storage.js';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Apaga arquivos de `dir` com mtime além de `dias`. Devolve os removidos. */
export async function limpar(dir, dias = config.regras.retencaoDias) {
  const limite = Date.now() - dias * UM_DIA_MS;
  const removidos = [];
  let entradas;
  try {
    entradas = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return removidos; // nada a limpar
    throw err;
  }
  for (const nome of entradas) {
    const alvo = path.join(dir, nome);
    try {
      const info = await stat(alvo);
      if (info.isFile() && info.mtimeMs < limite) {
        await unlink(alvo);
        removidos.push(nome);
      }
    } catch (err) {
      logger.warn({ arquivo: nome, erro: err.message }, 'falha ao avaliar/remover arquivo na retenção');
    }
  }
  return removidos;
}

/** Agenda a limpeza para rodar a cada 12h (e uma vez ao iniciar). */
export function agendarRetencao() {
  const executar = async () => {
    try {
      const dir = await garantirDataDir();
      const removidos = await limpar(dir);
      if (removidos.length) {
        logger.info({ quantidade: removidos.length }, 'retenção: arquivos antigos removidos');
      }
    } catch (err) {
      logger.error({ erro: err.message }, 'retenção: falha na execução');
    }
  };
  executar();
  const intervalo = setInterval(executar, 12 * 60 * 60 * 1000);
  intervalo.unref?.(); // não segura o processo vivo por causa do timer
  return intervalo;
}
