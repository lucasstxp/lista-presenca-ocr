// Microserviço HTTP. O n8n (orquestração visível) chama POST /processar com a
// imagem; devolvemos o XLS em base64 + resumo. Também guardamos o original e o
// XLS em /data (retenção automática).
import express from 'express';
import { config } from './core/config.js';
import { logger } from './core/logger.js';
import { ErroApp } from './core/errors.js';
import { estaAutorizado } from './core/auth.js';
import { salvarArquivo, extensaoDaImagem } from './core/storage.js';
import { baixarImagem } from './core/download.js';
import { agendarRetencao } from './core/retention.js';
import { extrairDaImagem } from './ocr/extractor.js';
import { gerarXlsx, nomeArquivoXlsx } from './xlsx/builder.js';

const app = express();
// Imagens em base64 podem ser grandes; limite generoso mas com teto.
app.use(express.json({ limit: '25mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, servico: 'lista-presenca-ocr' }));

app.post('/processar', async (req, res) => {
  // 1) Token compartilhado n8n -> microserviço (se configurado).
  if (config.microservicoToken) {
    const enviado = req.get('x-microservico-token');
    if (enviado !== config.microservicoToken) {
      logger.warn('token de microserviço inválido');
      return res.status(401).json({ ok: false, codigo: 'token_invalido' });
    }
  }

  const {
    imagem_base64: imagemBase64Entrada,
    imagem_url: imagemUrl,
    mime: mimeEntrada,
    remetente,
    grupo,
  } = req.body || {};

  // 2) Autorização (defesa em profundidade — o n8n também filtra).
  const auth = estaAutorizado({ remetente, grupo });
  if (!auth.autorizado) {
    logger.info({ remetente, motivo: auth.motivo }, 'mensagem ignorada (não autorizada)');
    return res.status(403).json({ ok: false, codigo: auth.motivo });
  }

  if (!imagemBase64Entrada && !imagemUrl) {
    return res.status(400).json({ ok: false, codigo: 'imagem_ausente' });
  }

  const inicio = Date.now();
  try {
    // 3) Obtém a imagem: base64 direto ou baixa da URL (uazapi entrega fileURL).
    let imagemBase64 = imagemBase64Entrada;
    let mime = mimeEntrada || 'image/jpeg';
    if (!imagemBase64 && imagemUrl) {
      const baixada = await baixarImagem(imagemUrl);
      imagemBase64 = baixada.base64;
      mime = mimeEntrada || baixada.mime;
    }

    // Nunca perder o original: salva a foto antes do OCR.
    const imagemBuffer = Buffer.from(imagemBase64, 'base64');
    const nomeOriginal = `original_${Date.now()}.${extensaoDaImagem(mime)}`;
    const caminhoOriginal = await salvarArquivo(nomeOriginal, imagemBuffer);

    // 4) OCR + validação (retry interno).
    const lista = await extrairDaImagem({ imagemBase64, mime });

    // 5) Geração do XLS.
    const xlsxBuffer = await gerarXlsx(lista);
    const nomeXlsx = nomeArquivoXlsx(lista);
    await salvarArquivo(nomeXlsx, xlsxBuffer);

    const emRevisao = lista.linhas.filter((l) => l.precisa_revisao).length;
    const resumo = {
      cliente: lista.cliente,
      cidade: lista.cidade,
      setor: lista.setor,
      turno: lista.turno,
      data: lista.data,
      total: lista.linhas.length,
      em_revisao: emRevisao,
    };

    // 6) Trilha de processamento (data, remetente, arquivo, nº linhas, nº revisão).
    logger.info(
      {
        remetente,
        arquivo: nomeXlsx,
        original: nomeOriginal,
        linhas: resumo.total,
        em_revisao: emRevisao,
        ms: Date.now() - inicio,
      },
      'processamento concluído',
    );

    return res.json({
      ok: true,
      modelo: config.anthropic.modelo,
      nome_arquivo: nomeXlsx,
      xlsx_base64: xlsxBuffer.toString('base64'),
      resumo,
      original_salvo: caminhoOriginal,
    });
  } catch (err) {
    if (err instanceof ErroApp) {
      logger.error({ codigo: err.codigo, erro: err.message }, 'falha ao processar (ErroApp)');
      return res
        .status(err.status)
        .json({ ok: false, codigo: err.codigo, mensagem_admin: err.mensagemAdmin });
    }
    logger.error({ erro: err.message, stack: err.stack }, 'falha inesperada ao processar');
    return res.status(500).json({
      ok: false,
      codigo: 'erro_interno',
      mensagem_admin: 'Não consegui processar a lista agora. Tente reenviar a foto.',
    });
  }
});

// Só sobe o servidor quando executado diretamente (facilita testes de importação).
const executadoDireto = process.argv[1] && process.argv[1].endsWith('server.js');
if (executadoDireto) {
  agendarRetencao();
  app.listen(config.porta, () => {
    logger.info(
      { porta: config.porta, modelo: config.anthropic.modelo, fallback: config.anthropic.modeloFallback },
      'microserviço no ar',
    );
  });
}

export { app };
