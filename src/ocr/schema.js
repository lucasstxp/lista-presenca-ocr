// Schema executável do contrato de saída do OCR (zod).
// A resposta do Claude DEVE validar aqui; caso contrário o extractor re-tenta.
import { z } from 'zod';

export const turnosSchema = z.object({
  turno_1: z.boolean(),
  turno_2: z.boolean(),
  turno_3: z.boolean(),
});

export const linhaSchema = z.object({
  nome: z.string().min(1),
  // Campo ilegível vira null (nunca chute) — aceita string ou null.
  matricula_ou_cpf: z.string().min(1).nullable(),
  turnos: turnosSchema,
  assinatura_ok: z.boolean(),
  confianca: z.number().min(0).max(1),
});

export const listaSchema = z.object({
  regiao: z.string().min(1),
  // Data no formato YYYY-MM-DD.
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser YYYY-MM-DD'),
  linhas: z.array(linhaSchema),
  observacoes: z.string().nullable(),
});

/**
 * Valida um objeto contra o contrato.
 * @returns {{ ok: true, data: import('../core/types.js').ListaExtraida }
 *          | { ok: false, erros: string }}
 */
export function validar(objeto) {
  const r = listaSchema.safeParse(objeto);
  if (r.success) return { ok: true, data: r.data };
  const erros = r.error.issues
    .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
    .join('; ');
  return { ok: false, erros };
}
