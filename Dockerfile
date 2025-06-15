# Multi-stage Dockerfile for Goethe B1 Wortliste
# Stage 1: Builder - Downloads PDF and prepares the environment
FROM node:22-bookworm-slim AS builder

# Accept build arguments for PDF configuration
ARG PDF_FILENAME=Goethe-Zertifikat_B1_Wortliste.pdf
ARG PDF_URL=https://web.archive.org/web/20250601000000/https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf
ARG PDF_URL_FALLBACK=https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf
ARG DEBUG=false

# Install system dependencies needed for build
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy environment configuration template
COPY .env.example .env

# Download the source PDF during build using build arguments
RUN wget --no-check-certificate -O "${PDF_FILENAME}" \
    "${PDF_URL}" || \
    wget -O "${PDF_FILENAME}" \
    "${PDF_URL_FALLBACK}"

# Stage 2: Runtime - Minimal production image
FROM node:22-bookworm-slim AS runtime

# Runtime stage requires no additional system dependencies
# All PDF processing is handled by the mupdf npm package (WebAssembly)

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install only production dependencies, skip prepare script (husky)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy source code (no tests)
COPY src/ ./src/

# Copy the downloaded PDF from builder stage
COPY --from=builder /app/*.pdf ./

# Copy environment configuration
COPY .env.example .env

# Create output directory
RUN mkdir -p output

# Use non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Default command runs the Node.js version
CMD ["node", "src/index.js", "--all"]