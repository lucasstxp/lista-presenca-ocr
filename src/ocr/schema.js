// Schema executável do contrato de saída do OCR (zod), alinhado ao modelo
// "Operações XD". A resposta do Claude DEVE validar aqui; senão, o extractor
// re-tenta.
import { z } from 'zod';

// String tolerante: aceita string ou número do modelo; vazio/nulo -> null.
const strNull = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  });

export const linhaSchema = z.object({
  nome_completo: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((s) => s.length > 0, 'nome_completo vazio'),
  cpf: strNull,
  data_nascimento: strNull,
  chave_pix: strNull,
  cargo: strNull,
  entrada: strNull,
  saida: strNull,
  assinatura_ok: z.boolean(),
  // aceita 0.5 ou "0.5"
  confianca: z.coerce.number().min(0).max(1),
});

export const listaSchema = z.object({
  turno: strNull,
  data: strNull, // idealmente YYYY-MM-DD; tolerante p/ não falhar leitura difícil
  unidade: strNull,
  setor: strNull,
  linhas: z.array(linhaSchema),
  observacoes: strNull,
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
