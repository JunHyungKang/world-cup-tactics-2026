# Static deployment contract

Corner Policy Lab is a keyless static React application. `pnpm build` produces the
complete site in `dist/`; it needs no server process, login, payment, browser
extension, warm storage, or runtime API key.

## Portable build gate

Vite uses `base: "./"`, so the generated JavaScript and CSS references resolve
both at an origin root and below a repository subpath. Run:

```bash
pnpm build
pnpm deployment:audit
```

The audit fails if `dist/index.html` uses a root-absolute local script or
stylesheet, references a missing or empty asset, traverses outside `dist/`, or
contains an entry-page password/API-key gate. It prints the complete local build
digest. This proves portable bytes only; it is not evidence that a public site
exists or matches those bytes.

## External release boundary

The deployable directory is `dist/`. GitHub Pages is the selected release host.
`.github/workflows/deploy-pages.yml` installs the pinned toolchain, builds and
audits the release, uploads only `dist/`, and deploys it through the official
Pages actions. The workflow runs only through `workflow_dispatch`; pushing a
branch cannot publish a candidate accidentally. A successful workflow alone is
still not the final parity claim.

After the P0 freeze and before the final deadline, the owner must create the
public GitHub repository, select GitHub Actions as the Pages source, and manually
run the Pages workflow from the exact release commit. Then use
`pnpm submission:build` to stamp `submission-build.json`. BG-12 and
`pnpm submission:preflight` must fetch that exact marker and every listed file
from the final HTTPS URL. Only those checks can establish public-release parity.
