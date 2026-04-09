FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY public ./public
ENV PORT=3000
EXPOSE $PORT
CMD sh -c "npx serve public -s -l tcp://0.0.0.0:$PORT"
