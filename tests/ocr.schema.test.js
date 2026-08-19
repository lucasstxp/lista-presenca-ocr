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
  assert.equal(r.data.cliente, 'IMILE RDC');
  assert.equal(r.data.cidade, 'POA');
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
    cliente: null,
    cidade: null,
    setor: null,
    turno: null,
    data: null,
    observacoes: null,
    linhas: [
      { nome_completo: 'Fulano', cpf: null, data_nascimento: null, chave_pix: null, cargo: null, entrada: null, saida: null, assinatura_ok: false, confianca: 0.3 },
    ],
  });
  assert.equal(r.ok, true);
});

test('linha sem nome não derruba a lista e é descartada no enriquecer', () => {
  const comVazia = structuredClone(amostra);
  comVazia.linhas.push({
    nome_completo: null, cpf: null, data_nascimento: null, chave_pix: null,
    cargo: null, entrada: null, saida: null, assinatura_ok: false, confianca: 0.2,
  });
  const v = validar(comVazia);
  assert.equal(v.ok, true); // não falha mais por causa da linha sem nome
  const enr = enriquecer(v.data, 0.85);
  assert.equal(enr.linhas.length, 3); // a linha sem nome foi descartada
});

test('extrairJson tolera cercas ```json e preâmbulo', () => {
  const texto =
    'Claro! Segue:\n```json\n{"cliente":"X","cidade":"POA","setor":null,"turno":null,"data":"2026-01-01","linhas":[],"observacoes":null}\n```';
  const obj = extrairJson(texto);
  assert.equal(obj.cliente, 'X');
});

test('enriquecer marca precisa_revisao abaixo do limite', () => {
  const enriquecida = enriquecer(amostra, 0.85);
  assert.equal(enriquecida.linhas[0].precisa_revisao, false); // 0.97
  assert.equal(enriquecida.linhas[1].precisa_revisao, true); // 0.62
  assert.equal(enriquecida.linhas[2].precisa_revisao, true); // 0.40
});
