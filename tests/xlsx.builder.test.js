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

  // Logo embutida (substitui o "XD" escrito).
  assert.ok(ws.getImages().length >= 1, 'logo embutida como imagem');
  assert.equal(ws.getCell('A2').value, null, 'texto XD removido');

  // Título da operação completo (C2) + campos de cabeçalho.
  assert.equal(ws.getCell('C2').value, 'OPERAÇÕES XD - IMILE RDC - POA');
  assert.match(String(ws.getCell('D5').value), /Turno:\s*2/);
  assert.match(String(ws.getCell('F5').value), /Unidade:\s*POA/);
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

  // Só as linhas preenchidas: 3 pessoas -> a tabela (com borda) termina na
  // linha 9; a linha 10 não tem mais borda (linhas vazias removidas).
  assert.equal(ws.getCell('A9').value, 3);
  assert.ok(ws.getCell('B9').border?.bottom, 'última pessoa (linha 9) tem borda');
  const b10 = ws.getCell('B10').border;
  assert.ok(!b10 || !b10.bottom, 'linha 10 sem borda (vazias removidas)');

  // Rodapé (assinaturas/data) removido — não deve haver a célula com o texto.
  assert.equal(ws.getCell('A44').value, null);
});

test('nome do arquivo segue lista_<cliente>_<cidade>_<data>_<ts>.xlsx', () => {
  const nome = nomeArquivoXlsx(amostra, new Date('2026-08-17T10:20:30.000Z'));
  assert.match(nome, /^lista_imile_rdc_poa_2026-08-17_.*\.xlsx$/);
});
