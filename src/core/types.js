// Tipos/shapes do contrato (modelo "Operações XD") via JSDoc.
// O schema executável vive em src/ocr/schema.js (zod).

/**
 * @typedef {Object} LinhaPresenca
 * @property {string} nome_completo
 * @property {string|null} cpf
 * @property {string|null} data_nascimento
 * @property {string|null} chave_pix
 * @property {string|null} cargo
 * @property {string|null} entrada
 * @property {string|null} saida
 * @property {boolean} assinatura_ok
 * @property {number} confianca            // 0.0 a 1.0
 * @property {boolean} [precisa_revisao]   // derivado após validação
 */

/**
 * @typedef {Object} ListaExtraida
 * @property {string|null} turno
 * @property {string|null} data            // idealmente YYYY-MM-DD
 * @property {string|null} unidade
 * @property {string|null} setor
 * @property {LinhaPresenca[]} linhas
 * @property {string|null} observacoes
 */

/**
 * @typedef {Object} EntradaProcessar
 * @property {string} [imagem_base64]
 * @property {string} [imagem_url]
 * @property {string} [mime]
 * @property {string} remetente
 * @property {string} [grupo]
 */

export {}; // módulo só de tipos
