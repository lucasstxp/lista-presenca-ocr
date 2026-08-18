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

test('preenche o template preservando cabeçalho e destacando revisão', async () => {
  const lista = enriquecer(amostra, 0.85);
  const buffer = await gerarXlsx(lista);
  assert.ok(buffer.length > 0);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];

  // Cabeçalho fixo do template preservado.
  assert.equal(ws.getCell('B6').value, 'NOME COMPLETO');
  assert.equal(ws.getCell('I6').value, 'ASSINATURA DO COLABORADOR');

  // Campos de cabeçalho preenchidos.
  assert.match(String(ws.getCell('D5').value), /Turno:\s*2/);
  assert.match(String(ws.getCell('F5').value), /Unidade:\s*Zona Leste/);
  assert.equal(ws.getCell('I1').value, '17/08/2026'); // data formatada

  // Linha 7 = primeira pessoa (Maria, alta confiança, sem destaque).
  assert.equal(ws.getCell('A7').value, 1);
  assert.equal(ws.getCell('B7').value, 'Maria Aparecida');
  assert.equal(ws.getCell('C7').value, '123.456.789-00');
  assert.equal(ws.getCell('I7').value, 'assinado');

  // Linha 8 = Joao (0.62) -> em revisão -> fundo destacado.
  assert.equal(ws.getCell('B8').value, 'Joao da Silva');
  const fill = ws.getCell('B8').fill;
  assert.equal(fill?.type, 'pattern');
  assert.equal(fill?.fgColor?.argb, 'FFFFF2CC');
});

test('nome do arquivo segue lista_<unidade>_<data>_<ts>.xlsx', () => {
  const nome = nomeArquivoXlsx(amostra, new Date('2026-08-17T10:20:30.000Z'));
  assert.match(nome, /^lista_zona_leste_2026-08-17_.*\.xlsx$/);
});
