import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

process.env.ANTHROPIC_API_KEY = 'chave-de-teste';
process.env.ADMIN_WHATSAPP = '5511999998888';
process.env.CONFIANCA_MINIMA = '0.85';

const { enriquecer } = await import('../src/ocr/extractor.js');
const { gerarXlsx, nomeArquivoXlsx } = await import('../src/xlsx/builder.js');

const aqui = path.dirname(fileURLToPath(import.meta.url));
const amostra = JSON.parse(
  await readFile(path.join(aqui, 'fixtures', 'amostra.json'), 'utf-8'),
);

test('gera XLS com abas Presenças + Resumo e destaca revisão', async () => {
  const lista = enriquecer(amostra, 0.85);
  const buffer = await gerarXlsx(lista);
  assert.ok(buffer.length > 0);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet('Presenças');
  const resumo = wb.getWorksheet('Resumo');
  assert.ok(ws, 'aba Presenças existe');
  assert.ok(resumo, 'aba Resumo existe');

  // Cabeçalho na ordem do contrato.
  assert.equal(ws.getRow(1).getCell(1).value, 'nome');
  assert.equal(ws.getRow(1).getCell(10).value, 'precisa_revisao');

  // 3 linhas de dados (linhas 2..4).
  assert.equal(ws.rowCount, 4);

  // Linha 1 (Maria, 0.97) NÃO em revisão; linha 2 (Joao, 0.62) em revisão.
  assert.equal(ws.getRow(2).getCell(10).value, '');
  assert.equal(ws.getRow(3).getCell(10).value, 'SIM');

  // A linha em revisão tem preenchimento de fundo (destaque).
  const fill = ws.getRow(3).getCell(1).fill;
  assert.equal(fill?.type, 'pattern');
  assert.equal(fill?.fgColor?.argb, 'FFFFF2CC');

  // Resumo: linha "Linhas em revisão" = 2.
  const linhasResumo = [];
  resumo.eachRow((row) => linhasResumo.push([row.getCell(1).value, row.getCell(2).value]));
  const emRevisao = linhasResumo.find((l) => l[0] === 'Linhas em revisão');
  assert.equal(emRevisao?.[1], 2);
});

test('nome do arquivo segue o padrão lista_<regiao>_<data>_<ts>.xlsx', () => {
  const nome = nomeArquivoXlsx(amostra, new Date('2026-08-17T10:20:30.000Z'));
  assert.match(nome, /^lista_zona_leste_2026-08-17_.*\.xlsx$/);
});
