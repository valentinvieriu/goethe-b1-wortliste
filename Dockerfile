FROM debian:bookworm-slim

# Install dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ruby imagemagick poppler-utils make wget git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy repository
COPY . /app

# Download the source PDF during build
RUN wget -O Goethe-Zertifikat_B1_Wortliste.pdf \
    https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf

CMD ["bash"]
