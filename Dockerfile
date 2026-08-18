# Microserviço de OCR/XLS — imagem enxuta para subir junto da infra self-hosted.
FROM node:20-slim

WORKDIR /app

# Instala só dependências de produção primeiro (melhor cache de camadas).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Código-fonte, prompt versionado e template do XLS.
COPY src ./src
COPY prompts ./prompts
COPY modelo_planilha.xlsx ./modelo_planilha.xlsx

# Diretório de dados temporários (montável como volume para persistir/limpar).
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
