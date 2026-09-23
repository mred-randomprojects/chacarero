# Deploy

The room server runs on the same DigitalOcean droplet as Piñas Cruzadas and
is reached through its Caddy at **https://pistasjug.ar/chacarero/**.

## One-time: route the path in Piñas' Caddyfile

In `pinas-cruzadas/Caddyfile` (which `pinas-cruzadas/deploy.sh` uploads):

```
pistasjug.ar {
	handle /chacarero/* {
		reverse_proxy chacarero:9902
	}
	handle {
		reverse_proxy pinas:9901
	}
}
```

Then reload Caddy on the droplet. The Caddyfile is a single-file bind mount,
so after `scp` (which replaces the inode) the container still sees the old
file until it restarts; feed the new config through stdin instead:

```bash
scp Caddyfile pinas-cruzadas:/root/pinas-cruzadas/Caddyfile
ssh pinas-cruzadas 'cd /root/pinas-cruzadas && docker compose exec -T caddy caddy validate --config /dev/stdin --adapter caddyfile < Caddyfile && docker compose exec -T caddy caddy reload --config /dev/stdin --adapter caddyfile < Caddyfile'
```

(Done once on 2026-09-19; `pinas-cruzadas/deploy.sh` re-uploads the same
Caddyfile on Piñas deploys, so keep the block in that repo.)

The `chacarero` container joins the `pinas-cruzadas_default` network (see
`docker-compose.yml`), which is how Caddy resolves the `chacarero` host.

## Every release

The droplet builds the image itself from a checkout of `main` in
`/root/chacarero`: the image holds only `server/`, `src/game`, `src/net` and
zod (no Vite build; the client is on GitHub Pages), so it builds in seconds
within the droplet's ~450 MB of RAM. `pistasjug.ar/chacarero/` redirects to
the Pages site.

```bash
./deploy.sh
```

SSHes in, resets the checkout to `origin/main` and runs `deploy/remote.sh`
(`docker compose up -d --build`). Push first: it deploys what is on GitHub.

### Automatic on push (optional, one-time setup)

The `server` job in `.github/workflows/deploy.yml` does the same after the
tests pass, once two repo secrets exist. Its key can only run the deploy:

```bash
ssh-keygen -t ed25519 -N "" -C chacarero-deploy -f /tmp/chacarero_deploy
ssh pinas-cruzadas "echo 'command=\"cd /root/chacarero && git fetch -q origin main && git reset -q --hard origin/main && exec deploy/remote.sh\",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty $(cat /tmp/chacarero_deploy.pub)' >> ~/.ssh/authorized_keys"
gh secret set DEPLOY_SSH_KEY < /tmp/chacarero_deploy
ssh-keyscan -t ed25519 167.172.140.176 | gh secret set DEPLOY_KNOWN_HOSTS
rm /tmp/chacarero_deploy /tmp/chacarero_deploy.pub
```

Anyone who can push to `main` can then run code on the droplet (through
`deploy/remote.sh`); that is the trade-off for never forgetting a deploy.

Health: `curl https://pistasjug.ar/chacarero/health` → `{"ok":true,"rooms":N}`.
Logs: `ssh pinas-cruzadas 'docker logs -f chacarero'`.

## GitHub Pages

The Pages build (`.github/workflows/deploy.yml`) also bakes in that WS URL,
so https://mred-randomprojects.github.io/chacarero/ talks to the same room
server. Without a reachable server the menu still offers hot-seat play.
