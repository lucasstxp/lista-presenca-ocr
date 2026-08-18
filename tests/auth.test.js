import { test } from 'node:test';
import assert from 'node:assert/strict';

// Config exige estas variáveis; definidas antes do import dinâmico.
process.env.ANTHROPIC_API_KEY = 'chave-de-teste';
process.env.ADMIN_WHATSAPP = '5511999998888';
delete process.env.GRUPO_AUTORIZADO;

const { estaAutorizado, mesmosNumeros, normalizarNumero } = await import('../src/core/auth.js');

test('normalizarNumero mantém apenas dígitos', () => {
  assert.equal(normalizarNumero('+55 (11) 99999-8888'), '5511999998888');
  assert.equal(normalizarNumero('5511999998888@s.whatsapp.net'), '5511999998888');
  assert.equal(normalizarNumero(undefined), '');
});

test('mesmosNumeros tolera DDI/formatação', () => {
  assert.equal(mesmosNumeros('5511999998888', '55 11 99999-8888'), true);
  assert.equal(mesmosNumeros('11999998888', '5511999998888'), true); // sufixo
  assert.equal(mesmosNumeros('5511999990000', '5511999998888'), false);
});

test('admin autorizada é aceita', () => {
  const r = estaAutorizado({ remetente: '5511999998888@s.whatsapp.net' });
  assert.equal(r.autorizado, true);
});

test('terceiros são rejeitados', () => {
  const r = estaAutorizado({ remetente: '5511000000000' });
  assert.equal(r.autorizado, false);
  assert.equal(r.motivo, 'remetente-nao-autorizado');
});

test('remetente ausente é rejeitado', () => {
  assert.equal(estaAutorizado({}).autorizado, false);
});
