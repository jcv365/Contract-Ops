# UI release — 5 November 2026

Deployed and verified on the existing Docker host. The UI review is in `docs/UNSLOP_REVIEW.md`.

- Service: `hunt-app`; Compose project `hunt-app`.
- UI source commit: `00653565af8a886a71f324ba1e0817243187883c`.
- Running image: `dotcloud-hunt:ui-20261105-82205464b7`.
- Verified image ID: `sha256:e38c88ef55f5738752e3035393587a5a4dc07228e75e6c6140b364c7e218246d`.
- Previous image retained for rollback: `sha256:83293ac9b16a474706c28dd85d9f051a784b599ef720535e402a150222aafbcc`.
- Live browser: http://127.0.0.1:3020/portal/login; HTTP 200.
- Chromium widths 1440, 768, 390 and 320 px passed: no page overflow or JavaScript page errors. Desktop and mobile screenshots were reviewed.
- Runtime environment hash, mounts, networks and published ports match the pre-deployment snapshot. Existing databases and volume mappings were preserved; no seed or migration command was run.

The release changes only UI files over the exact previous runtime image. Compose overrides select the verified local image and do not alter service settings. Images are stored on this Docker host; these overrides require the recorded image to be present.

Actual deployment command:

```powershell
docker compose --project-directory "C:\\opt\\hunt-app" -p hunt-app -f "C:\\opt\\hunt-app\\docker-compose.yml" -f "C:\\Users\\DotCloud-Docker\\OneDrive - DotCloud Consulting\\Code\\Contract ops\\compose.ui-release.yaml" up -d --no-build --no-deps --wait hunt-app
```

Rollback uses the same original Compose files, replacing the final override with `.artifacts/unslop/release/rollback.compose.yaml`. The previous image is also tagged `dotcloud-hunt:ui-base-83293ac9b16a`.

Local evidence: `.artifacts/unslop/release/deployed.json`, `hunt-live-browser.json`, build/deploy logs, screenshots and before/after configuration metadata. Evidence excludes environment values and remains ignored by Git.

The live browser checks are unauthenticated and block mutations. They verify delivered pages and responsive layout, not authenticated business workflows. Earlier fixture-based checks and remaining limitations are recorded in the UI review.
