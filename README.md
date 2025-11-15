# Proyecto Amestris Full-Stack

Amestris – Sistema de Gestión de Alquimia

Aplicación Full-Stack para la administración de alquimistas, materiales, misiones y transmutaciones con registro en tiempo real (SSE).
Incluye backend en Go, frontend en Next.js, autenticación JWT, Docker y documentación del API con Swagger y Postman.

✍️ Autores

Daniel Arévalo
Laura Melo

Universidad Jorge Tadeo Lozano
Profesor: Felipe Esteban Hernández Baquero
Curso: PROGRAMACIÓN AVANZADA (009069-1-2S-2025)

🚀 1. Tecnologías utilizadas
Backend

Go 1.21+

Fiber (Framework web)

PostgreSQL

SQL/Migrations

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

📦 2. Estructura del repositorio
Proyecto-Amestris/
│
├── backend/
│   ├── cmd/
│   ├── internal/
│   ├── migrations/
│   ├── seed.sql                 # Script con datos de ejemplo
│   ├── swagger/
│   └── go.mod / go.sum
│
├── frontend/
│   ├── src/app/
│   ├── src/components/
│   ├── src/context/
│   └── ...
│
├── docker-compose.yml
├── openapi.yaml                 # Documentación del API
├── Amestris-API.postman_collection.json
└── README.md

3. Base de datos y migraciones

La estructura de la base de datos se define mediante migraciones en la carpeta:

```bash
backend/migrations
Actualmente se incluyen:

0001_init.sql
Esta migración crea las tablas principales del sistema:

users

Campos: id, name, email, password_hash, role, created_at, updated_at

Almacena los usuarios de la aplicación (supervisores y alquimistas).

El campo email es único.

materials

Campos: id, name, stock, created_at, updated_at

Representa los materiales disponibles en el sistema y su stock actual.

missions

Campos: id, title, description, status, assigned_to, created_at, updated_at

Tabla de misiones, con un estado (status) y un usuario asignado (assigned_to → users.id).

transmutations

Campos: id, mission_id, requested_by, status, cost, result, created_at, updated_at

Registra transmutaciones asociadas opcionalmente a una misión (mission_id) y a un usuario solicitante (requested_by), con estado y resultado en formato JSON.

audits

Campos: id, entity, entity_id, action, actor_id, metadata, created_at

Tabla de auditoría para registrar acciones relevantes realizadas en el sistema.

También se crean índices para optimizar consultas frecuentes:

idx_users_email sobre users(email)

idx_missions_status sobre missions(status)

idx_transmutations_status sobre transmutations(status)

idx_audits_entity sobre audits(entity, entity_id)

0002_refresh_tokens.sql
Esta migración crea la tabla de tokens de refresco para autenticación:

refresh_tokens

Campos: id, user_id, token_hash, jti, expires_at, revoked_at, created_at

Relacionada con users(id) mediante user_id con ON DELETE CASCADE.

Incluye índices:

idx_refresh_user sobre refresh_tokens(user_id)

ux_refresh_jti (único) sobre refresh_tokens(jti)

Ejecución de las migraciones

Las migraciones se ejecutan automáticamente cuando se levanta el backend usando Docker Compose:

docker compose up --build

🌐 4. Documentación del API
Swagger (OpenAPI)

Accesible al ejecutar el backend:

👉 http://localhost:8080/api/docs

Colección Postman incluida

Archivo:

Amestris-API.postman_collection.json


Incluye pruebas completas de:

Autenticación

Alquimistas

Misiones

Materiales

Transmutaciones

Auditorías

Eventos SSE

🐳 5. Despliegue con Docker
Requisitos

Docker Desktop

Docker Compose

Levantar toda la aplicación
docker compose up --build


Servicios disponibles:

Servicio	Puerto	Descripción
Backend	8080	API + Swagger
Frontend	3000	Aplicación web
PostgreSQL	5432	Base de datos
Accesos importantes:

Frontend:
👉 http://localhost:3000

Swagger Backend:
👉 http://localhost:8080/api/docs

👥 6. Usuarios de prueba
Supervisor
email: roy@amestris.gov
password: fuego123
rol: SUPERVISOR

Alquimista
email: riza@amestris.gov
password: halcon123
rol: ALCHEMIST

🖥️ 7. Funcionalidad por roles
Supervisor

Panel con estadísticas

Gestión completa de:

Alquimistas

Materiales

Misiones (CRUD)

Transmutaciones

Auditorías

Historial y acciones visibles

Alquimista

Panel con misiones asignadas

Registro de transmutaciones

Consulta de historial propio

Sin permisos administrativos

🔔 8. Funciones destacadas

Autenticación JWT

Manejo de roles (RBAC)

SSE para actualizaciones en tiempo real

Control de stock automático

Auditoría integrada del sistema

UI moderna y responsiva

Validaciones en backend y frontend

🧪 9. Ejecución del backend sin Docker
cd backend
go mod tidy
go run ./cmd/api


Puedes probar la API con:

Swagger

Postman

cURL

📘 10. Cómo extender o mejorar

Agregar filtros avanzados en dashboard

Implementar notificaciones push

Integrar WebSockets

Exportar reportes en PDF/Excel

Modo oscuro en frontend

Roles adicionales (Administrador Maestro)

📝 11. Licencia

Uso académico – Universidad Jorge Tadeo Lozano.