FROM ghcr.io/oracle/oraclelinux8-instantclient:21
ENTRYPOINT ["./entrypoint.sh"]
WORKDIR /home/node
COPY . .

#ARG BUILD_SCRIPT=build

#ENV TNS_ADMIN /home/node # set in deployment env
#ENV LD_LIBRARY_PATH /home/node/instantclient
#ENV ORACLE_WALLET_DIRECTORY /home/node/wallet
#ENV ORACLE_CONNECT_TIMEOUT 10

# oraclelinux uses yam not apt-get
#RUN apt-get update && apt-get install -y build-essential git sudo
#RUN yum install sudo
RUN dnf install make gcc
RUN dnf module install python39
RUN dnf module enable nodejs:18
RUN dnf module install nodejs
#RUN export NODE_PATH=$(npm root -g)
#tzdata is already installed libaio1 does not exsist in yum 
#RUN yum install tzdata libaio1 
RUN yum install libaio
# does not find package.json
RUN npm i --omit=dev

#RUN apt-get install -y tzdata libaio1 && apt-get clean all
#Cleaning
RUN rm -rf /var/cache/dnf
CMD ["sqlplus", "-v"]
