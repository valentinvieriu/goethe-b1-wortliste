FROM node:22-bookworm-slim

# Install system dependencies
# sharp's dependencies: libvips is handled by pre-built binaries, but general build tools might be needed.
# wget is only required to download the source PDF during the build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       wget git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json first for better caching
COPY package.json ./
COPY package-lock.json ./

# Install npm dependencies (currently none, but good practice)
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY test/ ./test/

# Set default environment variables for PDF download
ENV PDF_FILENAME=Goethe-Zertifikat_B1_Wortliste.pdf
ENV PDF_URL=https://web.archive.org/web/20250601000000/https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf
ENV PDF_URL_FALLBACK=https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf

# Download the source PDF during build using environment variables
RUN wget --no-check-certificate -O "${PDF_FILENAME}" \
    "${PDF_URL}" || \
    wget -O "${PDF_FILENAME}" \
    "${PDF_URL_FALLBACK}"

# Create output directory
RUN mkdir -p output

# Default command runs the Node.js version
CMD ["npm", "run", "process:all"]