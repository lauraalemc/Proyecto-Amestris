# ========= STAGE: build =========
FROM golang:1.25-alpine AS build

WORKDIR /app
RUN apk add --no-cache git ca-certificates && update-ca-certificates

# Copia módulos y descarga deps
COPY go.mod go.sum ./
RUN go mod download

# Copia TODO el backend (asegúrate que .dockerignore no tape archivos)
COPY . .

# Compila binarios:
# - server: el main está en la raíz del backend (./)
# - worker: en ./cmd/worker
# - seed:   en ./cmd/seed
RUN CGO_ENABLED=0 GOOS=linux go build -o server .
RUN CGO_ENABLED=0 GOOS=linux go build -o worker ./cmd/worker
RUN CGO_ENABLED=0 GOOS=linux go build -o seed   ./cmd/seed

# ========= STAGE: runtime =========
FROM gcr.io/distroless/static-debian12:latest
WORKDIR /app

COPY --from=build /app/server /app/server
COPY --from=build /app/worker /app/worker
COPY --from=build /app/seed   /app/seed
COPY --from=build /app/docs   /app/docs

EXPOSE 8080
ENTRYPOINT ["/app/server"]
