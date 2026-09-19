# AutoFlow Studio

Static GitHub Pages build of AutoFlow Studio.

## Deploy

This repository includes a GitHub Actions workflow at:

`.github/workflows/deploy-pages.yml`

After the repository exists and these files are on the `main` branch:

1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** if GitHub has not selected it automatically.
3. Open the **Actions** tab and wait for **Deploy GitHub Pages** to finish.
4. Your Pages URL will appear in the deployment.

The web app itself is static and does not need a paid API.

The local Playwright runner is intentionally not included in the hosted Pages build because GitHub Pages cannot run a local Node/Playwright service.
