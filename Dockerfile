# Build context = aion-open/ (Railway root directory = aion-open).
# aion-open is self-contained: the shared bridge core is vendored under
# vendor/ (committed source), and ws is a normal dependency — so a single
# `npm install` from this directory satisfies everything.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3000 HOST=0.0.0.0
EXPOSE $PORT
CMD ["node", "server.js"]
