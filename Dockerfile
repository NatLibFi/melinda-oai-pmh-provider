FROM oraclelinux:8 as builder
ENTRYPOINT ["./entrypoint.sh"]
CMD ["/usr/local/bin/node", "index.js"]
WORKDIR /home/node

ARG BUILD_SCRIPT=build

ENV TNS_ADMIN /home/node
ENV LD_LIBRARY_PATH /home/node/instantclient
ENV ORACLE_WALLET_DIRECTORY /home/node/wallet
ENV ORACLE_CONNECT_TIMEOUT 10

#RUN apt-get update && apt-get install -y build-essential git sudo
RUN sudo dnf module enable nodejs:18
RUN sudo dnf module install nodejs
RUN npm i --production

#RUN apt-get install -y tzdata libaio1 && apt-get clean all
