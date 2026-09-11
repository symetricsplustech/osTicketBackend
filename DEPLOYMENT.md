# API deployment

GitHub Actions deploys `staging` to the GitHub **staging** environment and `main`
to the protected **production** environment. The workflow runs foundation tests,
uploads an immutable release to the server, runs Docker Compose, and checks
`/api/v1/health` before updating `current`.

Create these GitHub Environments and configure their environment-scoped values:

| Type | Name | Value |
|---|---|---|
| Secret | `SSH_HOST` | Server hostname or IP |
| Secret | `SSH_USER` | Restricted deployment user |
| Secret | `SSH_PRIVATE_KEY` | Private key for that deployment user |
| Secret | `DEPLOY_PATH` | Separate absolute path, e.g. `/srv/osticket/staging/api` |
| Variable | `SSH_PORT` | `22` unless changed |
| Variable | `API_PORT` | Distinct local port, e.g. `5001` staging and `5000` production |

On each server path, create a persistent `.env` containing `MONGO_URI`, `JWT_SECRET`,
mail credentials and all other backend runtime configuration. It is intentionally
never copied from GitHub. Install Docker Engine, Docker Compose v2 and `curl` on the
server, then configure the reverse proxy to route each API hostname to its API port.

Production should require approval in the GitHub Environment settings. Staging should
use a separate database, storage volume, hostname and API credentials.
