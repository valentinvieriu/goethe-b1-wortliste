# Docker & Docker Compose Usage

This project supports both Docker and Docker Compose for containerized execution.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Process all pages
docker-compose run --rm goethe-b1

# Process a single page
PAGE=42 docker-compose --profile page run --rm goethe-b1-page

# Run tests
docker-compose --profile test run --rm goethe-b1-test

# Development mode
docker-compose --profile dev run --rm goethe-b1-dev
```

### Using Traditional Docker

```bash
# Build the image
docker build -t goethe-b1 .

# Run processing
docker run --rm -v $(pwd)/output:/app/output goethe-b1
```

## Environment Configuration

### Method 1: .env File (Recommended)

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
# Edit .env with your custom values
```

Example `.env`:
```env
DEBUG=true
PDF_FILENAME=custom-wordlist.pdf
PDF_URL=https://example.com/custom.pdf
PDF_URL_FALLBACK=https://backup.com/custom.pdf
```

### Method 2: Environment Variables

```bash
# Override specific variables
DEBUG=true PDF_FILENAME=custom.pdf docker-compose run --rm goethe-b1
```

### Method 3: Build Arguments

```bash
# Custom build with different PDF
docker-compose build --build-arg PDF_URL=https://example.com/custom.pdf
```

## Available Services

### 🚀 Production Services

- **`goethe-b1`**: Main processing service (all pages)
- **`goethe-b1-page`**: Single page processing
  - Usage: `PAGE=42 docker-compose --profile page run --rm goethe-b1-page`

### 🔧 Development Services

- **`goethe-b1-dev`**: Development environment with source mounted
  - Usage: `docker-compose --profile dev run --rm goethe-b1-dev`
- **`goethe-b1-test`**: Test runner
  - Usage: `docker-compose --profile test run --rm goethe-b1-test`

## Configuration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `false` | Enable debug logging |
| `PDF_FILENAME` | `Goethe-Zertifikat_B1_Wortliste.pdf` | Name of the PDF file |
| `PDF_URL` | Web Archive URL | Primary download URL |
| `PDF_URL_FALLBACK` | Original Goethe URL | Backup download URL |
| `PAGE` | `42` | Page number for single page processing |
| `CUSTOM_PDF_PATH` | - | Path to mount custom PDF file |

## Volume Mounts

### Output Persistence

The `output/` directory is automatically mounted to persist results:

```bash
# Results will be available in ./output/ on your host
docker-compose run --rm goethe-b1
ls -la output/
```

### Custom PDF Files

Mount a custom PDF file:

```bash
# Using environment variable
CUSTOM_PDF_PATH=/path/to/your/custom.pdf docker-compose run --rm goethe-b1

# Or modify docker-compose.yml
volumes:
  - /path/to/your/custom.pdf:/app/custom.pdf
```

## Advanced Usage

### Build with Custom PDF

```bash
# Build image with different PDF source
docker-compose build \
  --build-arg PDF_URL=https://example.com/wordlist.pdf \
  --build-arg PDF_FILENAME=custom-wordlist.pdf
```

### Development Workflow

```bash
# Start development container with source mounted
docker-compose --profile dev run --rm goethe-b1-dev bash

# Inside container:
npm test
npm run lint
node src/index.js --page 42
```

### Production Deployment

```bash
# Build and run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Multi-Stage Build Benefits

- **Builder Stage**: Downloads PDF, installs build dependencies
- **Runtime Stage**: Minimal production image (492MB)
- **Security**: Runs as non-root user
- **Efficiency**: Caches dependencies separately from source code

## Troubleshooting

### Permission Issues

```bash
# Fix output directory permissions
sudo chown -R $USER:$USER output/
```

### Custom PDF Not Found

```bash
# Check if file exists and is accessible
ls -la /path/to/your/custom.pdf

# Verify mount in container
docker-compose run --rm goethe-b1 ls -la /app/
```

### Environment Variables Not Working

```bash
# Check if .env file is loaded
docker-compose config

# Verify variables in container
docker-compose run --rm goethe-b1 env | grep PDF
```

### Build Cache Issues

```bash
# Force rebuild without cache
docker-compose build --no-cache

# Remove old images
docker image prune -f
```