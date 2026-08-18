import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.ANTHROPIC_API_KEY = 'chave-de-teste';
process.env.ADMIN_WHATSAPP = '5511999998888';
process.env.CONFIANCA_MINIMA = '0.85';

const { validar } = await import('../src/ocr/schema.js');
const { extrairJson, enriquecer } = await import('../src/ocr/extractor.js');

const aqui = path.dirname(fileURLToPath(import.meta.url));
const amostra = JSON.parse(
  await readFile(path.join(aqui, 'fixtures', 'amostra.json'), 'utf-8'),
);

test('valida JSON no schema do contrato', () => {
  const r = validar(amostra);
  assert.equal(r.ok, true);
  assert.equal(r.data.linhas.length, 3);
});

test('rejeita JSON fora do contrato (confianca > 1)', () => {
  const ruim = structuredClone(amostra);
  ruim.linhas[0].confianca = 1.5;
  const r = validar(ruim);
  assert.equal(r.ok, false);
  assert.match(r.erros, /confianca/);
});

test('rejeita data em formato errado', () => {
  const ruim = structuredClone(amostra);
  ruim.data = '17/08/2026';
  assert.equal(validar(ruim).ok, false);
});

test('extrairJson tolera cercas ```json e preâmbulo', () => {
  const texto = 'Claro! Segue:\n```json\n{"regiao":"X","data":"2026-01-01","linhas":[],"observacoes":null}\n```';
  const obj = extrairJson(texto);
  assert.equal(obj.regiao, 'X');
});

test('enriquecer marca precisa_revisao abaixo do limite', () => {
  const enriquecida = enriquecer(amostra, 0.85);
  assert.equal(enriquecida.linhas[0].precisa_revisao, false); // 0.97
  assert.equal(enriquecida.linhas[1].precisa_revisao, true); // 0.62
  assert.equal(enriquecida.linhas[2].precisa_revisao, true); // 0.40
});
