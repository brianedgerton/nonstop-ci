# Nonstop-CI Docker Container

FROM ubuntu:14.04
MAINTAINER Leankit

ENV DEBIAN_FRONTEND noninteractive

#install
RUN apt-get update && \
    apt-get dist-upgrade -y && \
    apt-get install -y software-properties-common git curl python build-essential && \
    curl -sL https://deb.nodesource.com/setup_0.12 | sudo bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    npm update -g

RUN echo "inspect_addr: 0.0.0.0:4040" > ~/.ngrok

#ADD ./public /app/public
#ADD ./resource /app/resource
#ADD ./bin /app/bin
#ADD ./src /app/src
#ADD ./package.json /app/
#ADD ./gulpfile.js /app/

ADD . /app/

VOLUME ["/app/data"]

WORKDIR /app

RUN npm install

CMD ["./bin/nonstop-ci", "--server"]
