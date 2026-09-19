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

Then reload Caddy on the droplet:

```bash
ssh pinas-cruzadas 'cd /root/pinas-cruzadas && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile'
```

The `chacarero` container joins the `pinas-cruzadas_default` network (see
`docker-compose.yml`), which is how Caddy resolves the `chacarero` host.

## Every release

```bash
./deploy.sh
```

Builds the image for linux/amd64 with `VITE_WS_URL=wss://pistasjug.ar/chacarero/ws`
baked into the client, ships it over SSH and restarts the container.

## GitHub Pages

The Pages build (`.github/workflows/deploy.yml`) also bakes in that WS URL,
so https://mred-randomprojects.github.io/chacarero/ talks to the same room
server. Without a reachable server the menu still offers hot-seat play.
