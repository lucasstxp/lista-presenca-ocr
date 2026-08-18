// Tipos/shapes do contrato via JSDoc (documentação + auxílio do editor).
// O schema executável vive em src/ocr/schema.js (zod).

/**
 * @typedef {Object} Turnos
 * @property {boolean} turno_1
 * @property {boolean} turno_2
 * @property {boolean} turno_3
 */

/**
 * @typedef {Object} LinhaPresenca
 * @property {string} nome
 * @property {string|null} matricula_ou_cpf
 * @property {Turnos} turnos
 * @property {boolean} assinatura_ok
 * @property {number} confianca            // 0.0 a 1.0
 * @property {boolean} [precisa_revisao]   // derivado após validação
 */

/**
 * @typedef {Object} ListaExtraida
 * @property {string} regiao
 * @property {string} data                 // YYYY-MM-DD
 * @property {LinhaPresenca[]} linhas
 * @property {string|null} observacoes
 */

/**
 * @typedef {Object} EntradaProcessar
 * @property {string} imagem_base64
 * @property {string} [mime]
 * @property {string} remetente
 * @property {string} [grupo]
 * @property {string} [recebido_em]        // ISO 8601
 */

export {}; // módulo só de tipos
