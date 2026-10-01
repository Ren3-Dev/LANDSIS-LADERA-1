# LANDSIS LADERA-1

Sistema universitario que conecta el nodo IoT LADERA-1 con un backend, una base de datos y una aplicación web.

El objetivo general de este repositorio es organizar el desarrollo y la documentación de los componentes del sistema, manteniendo separados el firmware, el backend, el frontend y los archivos de base de datos.

## Arquitectura general prevista

Nodo LADERA-1 → HTTP/JSON → Backend → PostgreSQL → Aplicación web.

La comunicación del nodo está prevista mediante Wi-Fi. El backend utilizará Node.js y TypeScript, y la base de datos prevista es PostgreSQL.

## Organización del repositorio

- `firmware/`: firmware del nodo LADERA-1.
- `backend/`: backend del sistema y recepción de datos del nodo.
- `frontend/`: aplicación web del sistema.
- `database/`: archivos relacionados con la estructura y gestión de la base de datos.
- `docs/`: documentación técnica y académica del proyecto.

## Estado actual

El proyecto está en desarrollo. Actualmente el repositorio contiene la estructura inicial y sus documentos de orientación; los componentes aún no están implementados ni las dependencias configuradas.
