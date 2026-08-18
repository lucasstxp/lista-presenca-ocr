// Filtro de autorização: só processa mídia da administradora autorizada.
// Qualquer outro remetente é rejeitado (o server apenas registra e ignora).
import { config } from './config.js';

/** Normaliza um identificador de WhatsApp para apenas dígitos.
 *  Aceita formatos como "5511999998888", "5511999998888@s.whatsapp.net",
 *  "+55 11 99999-8888", etc. */
export function normalizarNumero(bruto) {
  if (bruto === undefined || bruto === null) return '';
  return String(bruto).replace(/\D/g, '');
}

/** Compara dois números de forma tolerante a DDI/formatação.
 *  Igualdade exata OU um é sufixo do outro (mín. 8 dígitos) — cobre casos em
 *  que o gateway entrega com/sem código de país. */
export function mesmosNumeros(a, b) {
  const na = normalizarNumero(a);
  const nb = normalizarNumero(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [curto, longo] = na.length <= nb.length ? [na, nb] : [nb, na];
  return curto.length >= 8 && longo.endsWith(curto);
}

/** Decide se a mensagem deve ser processada.
 *  @param {{ remetente?: string, grupo?: string }} origem
 *  @returns {{ autorizado: boolean, motivo?: string }} */
export function estaAutorizado({ remetente, grupo } = {}) {
  if (!mesmosNumeros(remetente, config.adminWhatsapp)) {
    return { autorizado: false, motivo: 'remetente-nao-autorizado' };
  }
  const grupoConfig = process.env.GRUPO_AUTORIZADO?.replace(/\D/g, '') || '';
  if (grupoConfig) {
    const grupoNorm = normalizarNumero(grupo);
    if (!grupoNorm || !grupoNorm.includes(grupoConfig)) {
      return { autorizado: false, motivo: 'grupo-nao-autorizado' };
    }
  }
  return { autorizado: true };
}
