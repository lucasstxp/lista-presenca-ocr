// Gera o XLS a partir dos dados validados.
// Contrato de colunas fixo; linhas em revisão destacadas; aba de resumo.
import ExcelJS from 'exceljs';
import { sanitizarPedaco } from '../core/storage.js';

const COLUNAS = [
  { header: 'nome', key: 'nome', width: 30 },
  { header: 'matricula_ou_cpf', key: 'matricula_ou_cpf', width: 20 },
  { header: 'data', key: 'data', width: 12 },
  { header: 'regiao', key: 'regiao', width: 18 },
  { header: 'turno_1', key: 'turno_1', width: 10 },
  { header: 'turno_2', key: 'turno_2', width: 10 },
  { header: 'turno_3', key: 'turno_3', width: 10 },
  { header: 'assinatura_ok', key: 'assinatura_ok', width: 14 },
  { header: 'confianca', key: 'confianca', width: 12 },
  { header: 'precisa_revisao', key: 'precisa_revisao', width: 16 },
];

const AMARELO_REVISAO = 'FFFFF2CC'; // fundo suave p/ linhas que precisam revisão
const CINZA_CABECALHO = 'FFD9D9D9';

/**
 * Constrói o workbook e devolve um Buffer .xlsx.
 * @param {import('../core/types.js').ListaExtraida} lista (já enriquecida)
 * @returns {Promise<Buffer>}
 */
export async function gerarXlsx(lista) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'lista-presenca-ocr';
  wb.created = new Date();

  // --- Aba de dados ---
  const ws = wb.addWorksheet('Presenças');
  ws.columns = COLUNAS;

  const cabecalho = ws.getRow(1);
  cabecalho.font = { bold: true };
  cabecalho.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_CABECALHO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  let emRevisao = 0;
  const totais = { turno_1: 0, turno_2: 0, turno_3: 0 };

  for (const linha of lista.linhas) {
    const turnos = linha.turnos || {};
    if (turnos.turno_1) totais.turno_1++;
    if (turnos.turno_2) totais.turno_2++;
    if (turnos.turno_3) totais.turno_3++;
    const precisaRevisao = Boolean(linha.precisa_revisao);
    if (precisaRevisao) emRevisao++;

    const row = ws.addRow({
      nome: linha.nome ?? '',
      matricula_ou_cpf: linha.matricula_ou_cpf ?? '',
      data: lista.data,
      regiao: lista.regiao,
      turno_1: turnos.turno_1 ? 'X' : '',
      turno_2: turnos.turno_2 ? 'X' : '',
      turno_3: turnos.turno_3 ? 'X' : '',
      assinatura_ok: linha.assinatura_ok ? 'sim' : 'não',
      confianca: Number(linha.confianca?.toFixed?.(2) ?? linha.confianca),
      precisa_revisao: precisaRevisao ? 'SIM' : '',
    });

    if (precisaRevisao) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARELO_REVISAO } };
      });
    }
  }

  ws.autoFilter = { from: 'A1', to: 'J1' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // --- Aba de resumo ---
  const resumo = wb.addWorksheet('Resumo');
  resumo.columns = [
    { header: 'Indicador', key: 'ind', width: 28 },
    { header: 'Valor', key: 'val', width: 16 },
  ];
  resumo.getRow(1).font = { bold: true };
  resumo.addRows([
    { ind: 'Região', val: lista.regiao },
    { ind: 'Data', val: lista.data },
    { ind: 'Total de linhas', val: lista.linhas.length },
    { ind: 'Presenças turno 1', val: totais.turno_1 },
    { ind: 'Presenças turno 2', val: totais.turno_2 },
    { ind: 'Presenças turno 3', val: totais.turno_3 },
    { ind: 'Linhas em revisão', val: emRevisao },
    { ind: 'Observações', val: lista.observacoes ?? '' },
  ]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Nome do arquivo: lista_<regiao>_<data>_<timestamp>.xlsx */
export function nomeArquivoXlsx(lista, agora = new Date()) {
  const regiao = sanitizarPedaco(lista.regiao, 'regiao');
  const data = sanitizarPedaco(lista.data, 'data');
  const ts = agora.toISOString().replace(/[:.]/g, '-');
  return `lista_${regiao}_${data}_${ts}.xlsx`;
}
