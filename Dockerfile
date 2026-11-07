# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /build/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production Python Backend + Static Assets
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY --from=frontend-builder /build/client/dist ./client/dist

EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

