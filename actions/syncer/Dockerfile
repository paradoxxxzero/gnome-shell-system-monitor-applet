FROM debian:buster

RUN apt update && apt install -y git

COPY . /app
CMD ["/app/run.sh"]
