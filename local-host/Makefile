# local-host/Makefile
#
# Convenience targets for survival-mode local hosting.

.PHONY: help up down logs build verify shell tunnel clean

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-12s\033[0m %s\n", $$1, $$2}'

up:  ## Start web + postgres (in background)
	docker compose up -d web postgres
	@echo "→ Web: http://localhost:3000"
	@echo "→ Run 'make verify' once it's healthy."

down:  ## Stop all services
	docker compose down

logs:  ## Tail web logs
	docker compose logs -f web

build:  ## Force a fresh build (ignores cache)
	docker compose build --no-cache web

verify:  ## Run the production smoke test against localhost
	APEX=http://localhost:3000 ../scripts/verify-production-runtime.sh

shell:  ## Open a shell in the web container
	docker compose exec web sh

tunnel:  ## Start the Cloudflare Tunnel (requires CLOUDFLARE_TUNNEL_TOKEN in .env)
	docker compose --profile tunnel up -d cloudflared
	docker compose logs -f cloudflared

clean:  ## Stop services and remove volumes (DESTROYS local DB data)
	@echo "WARNING: this will delete the local Postgres volume."
	@read -p "Type 'yes' to confirm: " c && [ "$$c" = "yes" ]
	docker compose down -v
