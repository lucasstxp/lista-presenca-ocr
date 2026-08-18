// Erro de aplicação: carrega uma mensagem técnica (log) e uma mensagem
// amigável para a admin (entregue no privado dela pelo n8n).
export class ErroApp extends Error {
  /**
   * @param {string} mensagem            mensagem técnica p/ log
   * @param {object} [opts]
   * @param {string} [opts.mensagemAdmin] texto amigável p/ a administradora
   * @param {number} [opts.status]        HTTP status sugerido
   * @param {string} [opts.codigo]        código curto p/ trilha
   */
  constructor(mensagem, { mensagemAdmin, status = 500, codigo = 'erro_interno' } = {}) {
    super(mensagem);
    this.name = 'ErroApp';
    this.mensagemAdmin =
      mensagemAdmin || 'Não consegui processar a lista. Reenvie a foto mais nítida, por favor.';
    this.status = status;
    this.codigo = codigo;
  }
}
