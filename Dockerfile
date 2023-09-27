FROM ghcr.io/oracle/oraclelinux8-nodejs:18 as builder
ENTRYPOINT ["./entrypoint.sh"]
CMD ["/usr/local/bin/node", "index.js"]
WORKDIR /home/node

#ARG BUILD_SCRIPT=build

#ENV TNS_ADMIN /home/node
#ENV LD_LIBRARY_PATH /home/node/instantclient
#ENV ORACLE_WALLET_DIRECTORY /home/node/wallet
#ENV ORACLE_CONNECT_TIMEOUT 10

# oraclelinux uses yam not apt-get
#RUN apt-get update && apt-get install -y build-essential git sudo
RUN yum install sudo git
#RUN export NODE_PATH=$(npm root -g)
#tzdata is already installed libaio1 does not exsist in yum 
#RUN yum install tzdata libaio1 
# does not find package.json
#RUN npm i --production

#RUN apt-get install -y tzdata libaio1 && apt-get clean all
