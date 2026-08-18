// Gera o XLS preenchendo o TEMPLATE oficial (modelo_planilha.xlsx / "Operações XD").
// Carregar o template preserva logo, textos das NRs, mesclagens e formatação.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { sanitizarPedaco } from '../core/storage.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const CAMINHO_TEMPLATE = path.resolve(aqui, '../../modelo_planilha.xlsx');

const LINHA_INICIAL = 7; // primeira linha de dados na ficha
const ULTIMA_PRE_FORMATADA = 42; // linhas com borda já prontas no template
const AMARELO_REVISAO = 'FFFFF2CC'; // destaque p/ linhas de baixa confiança

/** DD/MM/AAAA a partir de YYYY-MM-DD; senão devolve o texto como veio. */
function formatarData(data) {
  if (!data) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data).trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(data);
}

/** Escreve "Rótulo valor" na célula, preservando o estilo do rótulo. */
function preencherRotulo(ws, endereco, rotulo, valor) {
  ws.getCell(endereco).value = valor ? `${rotulo} ${valor}` : rotulo;
}

/** Monta o título da operação: "OPERAÇÕES XD - <cliente> - <cidade>". */
function montarTitulo(cliente, cidade) {
  const partes = ['OPERAÇÕES XD'];
  if (cliente) partes.push(cliente);
  if (cidade) partes.push(cidade);
  return partes.length > 1 ? partes.join(' - ') : '';
}

/** Copia o estilo (bordas/fonte/alinhamento) de uma linha para outra (A..I). */
function copiarEstiloLinha(ws, de, para) {
  const origem = ws.getRow(de);
  const destino = ws.getRow(para);
  for (let c = 1; c <= 9; c++) {
    destino.getCell(c).style = { ...origem.getCell(c).style };
  }
}

/**
 * Constrói o workbook preenchendo o template e devolve um Buffer .xlsx.
 * @param {import('../core/types.js').ListaExtraida} lista (já enriquecida)
 * @returns {Promise<Buffer>}
 */
export async function gerarXlsx(lista) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CAMINHO_TEMPLATE);
  const ws = wb.worksheets[0];

  // Título da operação (célula mesclada C2:E4): "OPERAÇÕES XD - <cliente> - <cidade>".
  const titulo = montarTitulo(lista.cliente, lista.cidade);
  if (titulo) ws.getCell('C2').value = titulo;

  // Cabeçalho da ficha (rótulos na linha 5 + data no topo direito).
  const dataFmt = formatarData(lista.data);
  preencherRotulo(ws, 'D5', 'Turno:', lista.turno);
  preencherRotulo(ws, 'E5', 'Data:', dataFmt);
  preencherRotulo(ws, 'F5', 'Unidade:', lista.cidade); // Unidade = CIDADE
  preencherRotulo(ws, 'G5', 'Setor:', lista.setor);
  if (dataFmt) ws.getCell('I1').value = dataFmt;

  // Linhas de dados.
  lista.linhas.forEach((linha, i) => {
    const r = LINHA_INICIAL + i;
    if (r > ULTIMA_PRE_FORMATADA) copiarEstiloLinha(ws, ULTIMA_PRE_FORMATADA, r);
    const row = ws.getRow(r);

    row.getCell(1).value = i + 1; // #
    row.getCell(2).value = linha.nome_completo ?? '';
    row.getCell(3).value = linha.cpf ?? '';
    row.getCell(4).value = linha.data_nascimento ?? '';
    row.getCell(5).value = linha.chave_pix ?? '';
    row.getCell(6).value = linha.cargo ?? '';
    row.getCell(7).value = linha.entrada ?? '';
    row.getCell(8).value = linha.saida ?? '';
    row.getCell(9).value = linha.assinatura_ok ? 'assinado' : '';

    // Linhas de baixa confiança destacadas + nota com a confiança.
    if (linha.precisa_revisao) {
      for (let c = 2; c <= 9; c++) {
        row.getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: AMARELO_REVISAO },
        };
      }
      row.getCell(2).note = `Confiança ${Number(linha.confianca).toFixed(2)} — revisar`;
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Nome do arquivo: lista_<cliente>_<cidade>_<data>_<timestamp>.xlsx */
export function nomeArquivoXlsx(lista, agora = new Date()) {
  const cliente = sanitizarPedaco(lista.cliente || '', '');
  const cidade = sanitizarPedaco(lista.cidade || '', '');
  const local = [cliente, cidade].filter(Boolean).join('_') || 'lista';
  const data = sanitizarPedaco(lista.data || 'sem-data', 'sem-data');
  const ts = agora.toISOString().replace(/[:.]/g, '-');
  return `lista_${local}_${data}_${ts}.xlsx`;
}
