# Services Up

Run the full backend stack from the PocketLib repository root:

```bash
docker compose -f Backend/services-up/docker-compose.yml up --build
```

Services exposed on the host:

- API: `http://localhost:8080`
- Postgres: `localhost:5432`
- MinIO S3 API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

Default dev credentials:

- Postgres: `pocketlib` / `pocketlib`, database `pocketlib`
- MinIO: `minio` / `miniosecret`, bucket `files`
- Default admin: `admin@university.edu` / `admin123`

The API applies the PocketLib schema and seed data on startup. Atlas files are kept as reference, but the Docker stack no longer needs a separate migration container.

Stop and remove volumes:

```bash
docker compose -f Backend/services-up/docker-compose.yml down -v
```
