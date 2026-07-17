.PHONY: dev build test typecheck verify data-audit harness-audit

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

typecheck:
	pnpm typecheck

verify:
	pnpm verify

data-audit:
	pnpm data:audit

harness-audit:
	pnpm harness:audit
