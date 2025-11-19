Proyecto Amestris Full-Stack

Amestris – Sistema de Gestión de Alquimia

Aplicación Full-Stack para la administración de alquimistas, materiales, misiones y transmutaciones con registro en tiempo real (SSE).
Incluye backend en Go, frontend en Next.js, autenticación JWT, Docker y documentación del API con Swagger y Postman.

Autores
Daniel Arévalo
Laura Melo

Universidad Jorge Tadeo Lozano
Profesor: Felipe Esteban Hernández Baquero
Curso: PROGRAMACIÓN AVANZADA (009069-1-2S-2025)

1. Tecnologías utilizadas
Backend

Go 1.21+

Fiber (Framework web)

PostgreSQL

SQL Migrations

Swagger (OpenAPI)

JWT Authentication

Server-Sent Events (SSE)

Frontend

Next.js (App Router)

TypeScript

TailwindCSS

Context API (Auth + Toast)

RealtimeBridge para SSE

Infraestructura

Docker & Docker Compose

Contenedores:

postgres

backend

frontend

redis

worker

seed (script de inicialización automático)

2. Estructura del repositorio
Proyecto-Amestris/
│
├── backend/
│   ├── cmd/
│   │   ├── api/          # Servidor principal
│   │   └── seed/         # Servicio de seed (Go) → inicializa datos reales
│   ├── internal/         # Lógica interna (auth, modelos, handlers)
│   ├── migrations/       # Migraciones SQL
│   ├── swagger/          # Documentación OpenAPI
│   └── go.mod / go.sum
│
├── frontend/
│   ├── src/app/          # Rutas del proyecto (App Router)
│   ├── src/components/
│   ├── src/context/
│   └── ...
│
├── docker-compose.yml
├── openapi.yaml
├── Amestris-API.postman_collection.json
└── README.md

3. Base de datos y migraciones

Las migraciones están en:

backend/migrations/


Incluye:

0001_init.sql

Crea las tablas principales:

users

materials

missions

transmutations

audits

Incluye índices optimizados para búsqueda por email, estado, etc.

0002_refresh_tokens.sql

Crea la tabla:

refresh_tokens (tokens de refresco para JWT)

Ejecutar migraciones

Se aplican automáticamente al ejecutar:

docker compose up --build

4. Seed (Datos de ejemplo)

Este proyecto no utiliza un seed.sql, sino un servicio independiente en Go ubicado en:

backend/cmd/seed/


Este servicio:

Se conecta automáticamente a PostgreSQL.

Crea/actualiza:

Usuarios de prueba

Materiales iniciales

Misiones de ejemplo

Muestra logs como:

🌱 Seed: iniciando…
📦 Material actualizado: Mercurio refinado
🗂️ Misión actualizada: Inspección en Central City
🌿 Seed: terminado.


El contenedor seed se ejecuta solo una vez y luego sale con éxito (exit 0).

Esto cumple con el requisito:

“Script de inicialización de la base de datos con datos de ejemplo.”

5. Documentación del API
Swagger (OpenAPI)

Accesible en:

http://localhost:8080/api/docs

Postman

Incluye la colección:

Amestris-API.postman_collection.json


Contiene pruebas para:

Autenticación

Misiones

Materiales

Transmutaciones

SSE

Auditorías

6. Despliegue con Docker
Requisitos

Docker Desktop

Docker Compose

Levantar todo el sistema
docker compose up --build

Servicios disponibles
Servicio	Puerto	Descripción
Backend	8080	API + Swagger
Frontend	3000	Aplicación web
PostgreSQL	5432	Base de datos
Redis	6379	Cache/Queue
Worker	—	Procesa eventos
Seed	—	Inicializa datos

Accesos importantes:

Frontend: http://localhost:3000

API/Swagger: http://localhost:8080/api/docs

7. Usuarios de prueba
Supervisor

email: roy@amestris.gov

password: roy123

rol: SUPERVISOR

Alquimista

email: riza@amestris.gov

password: riza123

rol: ALCHEMIST

8. Funcionalidad por roles
Supervisor

Acceso total al sistema

CRUD completo de:

Alquimistas

Misiones

Materiales

Transmutaciones

Auditorías en tiempo real

Panel con estadísticas

Alquimista

Ver misiones asignadas

Registrar transmutaciones

Ver historial propio

Sin acceso administrativo

9. Funciones destacadas

Autenticación JWT con refresh tokens

Control de permisos por rol (RBAC)

Auditoría integrada

SSE para actualizaciones automáticas

Control de stock de materiales

UI responsiva con Tailwind

Normalización de datos en frontend

Manejo avanzado de estados y errores

10. Ejecución del backend sin Docker
cd backend
go mod tidy
go run ./cmd/api

11. Mejoras futuras

WebSockets en lugar de SSE

Filtros avanzados en dashboard

Reportes PDF / Excel

Modo oscuro

Roles adicionales

12. Licencia

Proyecto académico — Universidad Jorge Tadeo Lozano.
