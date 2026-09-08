# GitHub Actions PR & Release Separation

## Background & Context
Currently, the Auto Clipper project uses a single GitHub Actions workflow (`build.yml`) that runs on both `push` (main/tags) and `pull_request` (main). Because it uses the `tauri-apps/tauri-action` step with release parameters, any successful build inside a Pull Request automatically generates a GitHub Release. This is unintended behavior, as releases should only be generated from the `main` branch or specific version tags.

## Goals
- Prevent pull requests from generating GitHub Releases.
- Ensure pull requests still undergo full compilation testing to catch build errors early.
- Maintain identical build environments between PR checks and actual releases to ensure accuracy.

## Architecture & Components

The CI pipeline will be split into two separate workflow files:

### 1. PR Check Workflow (`pr-check.yml`)
- **Trigger:** Runs exclusively on `pull_request` targeting the `main` branch.
- **Environment:** Mirrors the exact Node.js, Python, Rust, and FFmpeg setup as the release workflow.
- **Action:** Instead of invoking `tauri-action`, it will run a pure compilation command (`npm run tauri build -- --target ${{ matrix.target }}`).
- **Outcome:** Fails the PR check if compilation errors occur. Does NOT create a GitHub release and does NOT upload any build artifacts.

### 2. Release Workflow (`build.yml` or `release.yml`)
- **Trigger:** Runs exclusively on `push` to the `main` branch and specific version tags (e.g., `v*`).
- **Environment:** Identical environment setup.
- **Action:** Continues to use `tauri-apps/tauri-action` to build the app, create the GitHub Release, and upload installer artifacts.
- **Outcome:** Deploys a new version to users automatically upon merging to `main` or pushing a tag.

## Error Handling & Testing
- If a PR introduces breaking changes to the Python backend or Rust Tauri code, `npm run tauri build` in `pr-check.yml` will exit with a non-zero status code, correctly blocking the PR.
- No changes to application source code are required.

## Next Steps for Implementation
1. Copy the contents of `.github/workflows/build.yml` into `.github/workflows/pr-check.yml`.
2. In `pr-check.yml`, change the `on` triggers to `pull_request` only.
3. Replace the `tauri-action` step with `npm run tauri build -- --target ${{ matrix.target }}`.
4. In the original `build.yml`, remove the `pull_request` trigger.
