FROM node:18-alpine as builder
WORKDIR /home/node

RUN sh -c 'npm i --ignore-scripts && npm run build && rm -rf node_modules'
RUN sh -c 'npm i --ignore-scripts --production'

FROM ghcr.io/oracle/oraclelinux8-instantclient:21
ENTRYPOINT ["./entrypoint.sh"]
WORKDIR /home/node

COPY --from=builder /home/node/dist/ .
COPY --from=builder /home/node/node_modules node_modules
COPY --from=builder /home/node/package.json .
COPY --from=builder /home/node/package-lock.json .

#ENV TNS_ADMIN /home/node # set in deployment env
#ENV ORACLE_WALLET_DIRECTORY /run/wallet # set in deployment env


# oraclelinux uses yam not apt-get
#RUN apt-get update && apt-get install -y build-essential git sudo
#RUN yum install sudo
RUN yum install gcc-c++ libstdc++
RUN dnf install make
RUN dnf module install python39
RUN dnf module enable nodejs:18
RUN dnf module install nodejs
#RUN export NODE_PATH=$(npm root -g)
#tzdata is already installed libaio1 does not exsist in yum 
#RUN yum install tzdata libaio1 
#libaio is already installed, is it same as libaio1? 
#RUN yum install libaio
# does not find package.json
RUN npm i --omit=dev

#RUN apt-get install -y tzdata libaio1 && apt-get clean all
#Cleaning
RUN rm -rf /var/cache/dnf
