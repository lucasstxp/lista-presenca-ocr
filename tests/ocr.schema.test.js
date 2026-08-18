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

test('valida JSON no schema do modelo', () => {
  const r = validar(amostra);
  assert.equal(r.ok, true);
  assert.equal(r.data.linhas.length, 3);
  assert.equal(r.data.unidade, 'Zona Leste');
  assert.equal(r.data.linhas[0].chave_pix, 'maria@email.com');
});

test('rejeita JSON fora do contrato (confianca > 1)', () => {
  const ruim = structuredClone(amostra);
  ruim.linhas[0].confianca = 1.5;
  const r = validar(ruim);
  assert.equal(r.ok, false);
  assert.match(r.erros, /confianca/);
});

test('aceita campos ausentes como null (linha só com nome)', () => {
  const r = validar({
    turno: null,
    data: null,
    unidade: null,
    setor: null,
    observacoes: null,
    linhas: [
      { nome_completo: 'Fulano', cpf: null, data_nascimento: null, chave_pix: null, cargo: null, entrada: null, saida: null, assinatura_ok: false, confianca: 0.3 },
    ],
  });
  assert.equal(r.ok, true);
});

test('extrairJson tolera cercas ```json e preâmbulo', () => {
  const texto =
    'Claro! Segue:\n```json\n{"turno":null,"data":"2026-01-01","unidade":"X","setor":null,"linhas":[],"observacoes":null}\n```';
  const obj = extrairJson(texto);
  assert.equal(obj.unidade, 'X');
});

test('enriquecer marca precisa_revisao abaixo do limite', () => {
  const enriquecida = enriquecer(amostra, 0.85);
  assert.equal(enriquecida.linhas[0].precisa_revisao, false); // 0.97
  assert.equal(enriquecida.linhas[1].precisa_revisao, true); // 0.62
  assert.equal(enriquecida.linhas[2].precisa_revisao, true); // 0.40
});
