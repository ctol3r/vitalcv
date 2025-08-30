.PHONY: bootstrap lint test bench build up down smoke
bootstrap:
	cp -n .env.example .env || true
	npm ci || true
lint:
	npm run lint || true
test:
	npm test --silent || true
bench:
	npm run bench || true
build:
	docker compose build
up:
	docker compose up -d
down:
	docker compose down -v
smoke:
	curl -fsS http://localhost:8080/health || exit 1

