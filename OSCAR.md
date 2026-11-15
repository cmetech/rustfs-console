# OSCAR Console downstream

This is the OSCAR Modern theme for RustFS Console. `main` mirrors upstream unchanged; `oscar` contains the customization. `origin` is `cmetech/rustfs-console`; `upstream` is `rustfs/console`.

## Local build

Use Node 22 (`nvm use v22`, or the equivalent installed Node 22 runtime) and pnpm 12.3.4. Supply the existing OSCAR assets from an authorized local checkout:

```sh
pnpm install --frozen-lockfile
node scripts/oscar-stage-assets.mjs ../oscar-adminui/public
NEXT_PUBLIC_THEME_ID=oscar pnpm type-check
pnpm lint
pnpm format:check
pnpm test:run
NEXT_PUBLIC_THEME_ID=oscar pnpm build
```

The asset script validates every input before copying. Fonts and logos are ignored under `themes/oscar/private-assets/`; they are not published in this source fork. The generated build does contain them and belongs in approved OSCAR distribution channels. A clean checkout must stage assets before checking/building the OSCAR theme. Upstream GitHub workflows use upstream-specific runners and do not constitute an OSCAR release pipeline.

`out/` is the complete static artifact (including `/rustfs/console/`). Preview it with `python3 -m http.server 3099 --bind 127.0.0.1 --directory out`, then open `http://127.0.0.1:3099/rustfs/console/auth/login/?oscar-mode=dark`. A static preview alone cannot authenticate or access storage. `next start` is not the server for this static export.

Theme application temporarily replaces the tracked provider and logo components. **Before committing or merging**, restore the upstream files with `THEME_ID=default node scripts/apply-theme-overrides.js` (ensure `NEXT_PUBLIC_THEME_ID` is unset). Commit the sources under `themes/oscar`, not generated overlay copies. Never switch themes while a build is running.

## Appearance contract

The launch parameter `oscar-mode=light|dark` takes priority on initial load; it is persisted before authentication redirects and removed without deleting other query parameters or the fragment. On the same hostname, the existing `oscar-ui-mode` cookie follows OSCAR mode changes on focus/visibility and every 30 seconds while visible. OSCAR's cookie is Secure, so production must use HTTPS. Without either input, the Console's saved preference and system fallback remain available. Blocked local storage still permits the initial appearance handoff through an in-memory DOM attribute.

A separate hostname can receive the initial launch parameter but cannot read OSCAR's host-only cookie. Continuous cross-origin appearance synchronization requires the planned authenticated preference endpoint and is not implemented in this prototype. There is no opener access, broad CORS, or credential handoff in the theme code.

## Engine integration

Console base: `2366e2a95ded436f830c0049dfe88174ccaeb45d`. Candidate engine: RustFS `1.0.5`, commit `34e6449ed90e3d3a106f6655342e0b3127f33082`. Record the final Console commit, engine digest, build environment, configuration and archive SHA256 for every delivery; do not deploy a moving `latest` tag.

RustFS embeds its Console at engine compile time. Choose either:

- Serve this static export behind OSCAR's same-origin reverse proxy. Route admin/S3 traffic to RustFS; preserve the dynamic Console `/version`, `/license` and `/health` routes rather than intercepting them with static files.
- Copy the complete export to the pinned engine source's `rustfs/static`, then use `build-rustfs.sh --no-console`. This preserves the supplied Console. The upstream source Dockerfile downloads Console assets, so it must not be used unchanged for the branded build.

Engine packaging references: [Console build](https://github.com/rustfs/console/blob/2366e2a95ded436f830c0049dfe88174ccaeb45d/next.config.ts), [embedded assets](https://github.com/rustfs/rustfs/blob/34e6449ed90e3d3a106f6655342e0b3127f33082/rustfs/src/admin/console.rs).

Local qualification against the verified 1.0.5 macOS arm64 release passed: Console login/STS helpers, signed admin endpoints, version/license/health, empty listing, bucket creation, upload/download byte equality and cleanup. Browser login and empty bucket views passed in light/dark modes and at mobile width through a temporary same-origin proxy. Before release, qualify role-specific permissions, OIDC when configured, production proxy/TLS paths and rollback against the chosen engine. This fork does not deploy or restart OSCAR services.

## Upstream updates

Use [the upstream merge skill](.agents/skills/oscar-upstream-merge/SKILL.md) and its [customization ledger](docs/upstream-customizations/oscar.json). The script produces an upstream-change inventory and can rehearse a merge in an isolated worktree. It never merges into `oscar`, advances `main`, pushes, or releases automatically. Review upstream changes to overlaid components even when Git reports no conflict.

## OSCAR session sign-in

Core packaging sets `NEXT_PUBLIC_OSCAR_SSO_ENABLED=true` at build time. The Console POSTs to its same-origin `/oscar-session/` gateway with cookies and a fixed CSRF header; the OSCAR broker validates the current administrator account and returns short-lived STS credentials. It never receives an OSCAR password, OAuth login prompt, signing key or bootstrap credential. Children remain hidden until admission, and a principal change remounts the app. Failures clear stored credentials and show Retry; there is no automatic fallback to native login in this build. Refresh occurs on focus/visibility and every five minutes while visible.

The issuer is a hidden workload-only federation provider, not an interactive OAuth server. The same-hostname deployment is required for OSCAR's host-only cookie. Previously issued STS credentials remain usable until their 15-minute expiry even after OSCAR logout or role revocation. Native emergency access is available only through the private engine Console, outside the public branded gateway. See the core operator guide `docs/user_documentation/09-administration/object-storage-console.md`.

## Runtime brand assets

The OSCAR theme loads logoLight/logoDark (and compact 48 variants) and favicon from the same-origin `/rustfs/console/oscar-branding/<slot>/` gateway. The gateway forwards only these read-only public assets to AdminUI's `/api/branding/assets/<slot>/`, which uses OSCAR's existing upload/template/company fallback chain. No image credentials or signed storage URLs are involved. Branding uploads/removals take effect on page reload without a Console rebuild. Light/dark switches request the corresponding logo slot. The theme application script backs up/removes Next's file-based Rust icons while OSCAR is active and restores them for other themes; preserve this behavior across upstream merges.
