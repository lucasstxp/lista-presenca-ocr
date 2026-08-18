// Persistência de arquivos temporários em /data.
// Princípio do projeto: "nunca perder o original" — a foto é salva antes do OCR.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

/** Remove caracteres perigosos de um pedaço de nome de arquivo. */
export function sanitizarPedaco(texto, padrao = 'desconhecido') {
  const limpo = String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (marcas combinantes)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return limpo || padrao;
}

/** Garante que o DATA_DIR existe e devolve o caminho absoluto. */
export async function garantirDataDir() {
  const dir = path.resolve(config.dataDir);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Salva um Buffer em /data com o nome informado; devolve o caminho absoluto. */
export async function salvarArquivo(nomeArquivo, buffer) {
  const dir = await garantirDataDir();
  const destino = path.join(dir, path.basename(nomeArquivo));
  await writeFile(destino, buffer);
  return destino;
}

/** Extensão de imagem a partir do mime. */
export function extensaoDaImagem(mime) {
  const mapa = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return mapa[mime] || 'jpg';
}
