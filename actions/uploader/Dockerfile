FROM debian:bookworm

ENV LANG="en_US.UTF-8"
RUN apt update && apt install -y curl

RUN apt install -y \
        bc \
        build-essential \
        chromium \
        chromium-driver \
        gettext \
        gir1.2-clutter-1.0 \
        gir1.2-gtop-2.0 \
        gir1.2-nm-1.0 \
        git \
        libglib2.0-bin \
        python3-selenium \
        unzip \
        zip

COPY . /app
CMD ["/app/run.sh"]
