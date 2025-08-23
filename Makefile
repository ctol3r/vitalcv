.PHONY: ai-setup ai-test backend-setup backend-test test all

# AI matcher (Python)
ai-setup:
	cd ai-matcher-service && python3 -m venv .venv && . .venv/bin/activate && pip install -U pip && \
	( [ -f requirements.txt ] && pip install -r requirements.txt || pip install pytest numpy pandas scikit-learn )

ai-test:
	cd ai-matcher-service && . .venv/bin/activate && pytest -q

# Backend (Python)
backend-setup:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -U pip && \
	( [ -f requirements.txt ] && pip install -r requirements.txt || pip install pytest )

backend-test:
	cd backend && . .venv/bin/activate && pytest -q

# Run everything
test: ai-setup backend-setup ai-test backend-test
all: test
