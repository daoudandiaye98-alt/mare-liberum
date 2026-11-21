# Mare Liberum on your own machine, in a container: docker build -t mare-liberum . && docker run -p 8787:8787 -v mare:/data mare-liberum
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN mkdir -p /data && chown node:node /data
ENV HOST=0.0.0.0 PORT=8787 MARE_STATE=/data MARE_HARBOUR_ROOM=10
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "serve.mjs"]
