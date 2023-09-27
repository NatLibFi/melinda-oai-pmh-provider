FROM oraclelinux:8 as builder
ENTRYPOINT ["./entrypoint.sh"]
CMD ["/usr/local/bin/node", "index.js"]
WORKDIR /home/node

ARG BUILD_SCRIPT=build

COPY --chown=node:node . build

RUN apt-get update && apt-get install -y build-essential git sudo
RUN sudo dnf module enable nodejs:18
RUN sudo dnf module install nodejs
RUN npm i --production

FROM oraclelinux:8
WORKDIR /home/node

ENTRYPOINT ["./entrypoint.sh"]
CMD ["/usr/local/bin/node", "index.js"]
WORKDIR /home/node

ENV TNS_ADMIN /home/node
ENV LD_LIBRARY_PATH /home/node/instantclient
ENV ORACLE_WALLET_DIRECTORY /home/node/wallet
ENV ORACLE_CONNECT_TIMEOUT 10

COPY --chown=node:node instantclient /home/node/instantclient
COPY --chown=node:node *.template entrypoint.sh /home/node/

COPY --from=builder --chown=node:node /home/node/build/node_modules/ /home/node/node_modules
COPY --from=builder --chown=node:node /home/node/build/dist/ /home/node/

RUN sudo dnf module enable nodejs:18
RUN sudo dnf module install nodejs
RUN apt-get update && apt-get install -y tzdata libaio1 \
  && apt-get clean all

USER node
