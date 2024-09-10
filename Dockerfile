FROM python:3-slim-buster

LABEL maintainer="mamath"

ARG DEVICE_IP
ARG DEVICE_NAME
ENV IP ${DEVICE_IP}
ENV NAME ${DEVICE_NAME}

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt && \
    apt-get update && apt-get install -y \
        fping && \
    apt-get clean

WORKDIR /app
WORKDIR /app/config
VOLUME /app/config

WORKDIR /app

ADD app/* /app


# CMD [ "python3", "/app/getPzemData.py"]
CMD ["/bin/bash", "/app/loop.sh"]


