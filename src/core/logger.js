// Logger estruturado (pino). Um único ponto de configuração.
import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.logLevel,
  // Evita vazar dados sensíveis em log por acidente.
  redact: {
    paths: ['req.headers["x-microservico-token"]', 'imagem_base64', 'xlsx_base64'],
    censor: '[oculto]',
  },
});
