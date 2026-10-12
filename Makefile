test:
	docker compose run --rm node node --test test/model.test.js

serve:
	@echo "http://localhost:8080"
	docker compose up web

.PHONY: test serve
