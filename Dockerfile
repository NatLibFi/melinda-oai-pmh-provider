FROM node:18-alpine as builder
WORKDIR /home/node
COPY . .

RUN sh -c 'npm i --ignore-scripts && npm run build && rm -rf node_modules'
RUN sh -c 'npm i --ignore-scripts --production'

FROM node:18-alpine
WORKDIR /home/node

COPY --from=builder /home/node/dist/ .
COPY --from=builder /home/node/node_modules node_modules
COPY --from=builder /home/node/package.json .
COPY --from=builder /home/node/package-lock.json .

RUN apt-get update && apt-get install -y tzdata libaio1 && apt-get clean all
