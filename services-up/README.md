# Services Up

Run the full backend stack from the repository root:

```bash
docker compose -f services-up/docker-compose.yml up --build
```

Services exposed on the host:

- API: `http://localhost:8080`
- Postgres: `localhost:5432`
- MinIO S3 API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

Default dev credentials:

- Postgres: `pocketlib` / `pocketlib`, database `pocketlib`
- MinIO: `minio` / `miniosecret`, bucket `files`
- Default admin registration input: `admin` / `admin`

Stop and remove volumes:

```bash
docker compose -f services-up/docker-compose.yml down -v
```
