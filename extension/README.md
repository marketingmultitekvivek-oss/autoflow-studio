# AutoFlow Studio Chrome Extension

This folder turns AutoFlow Studio into a direct browser automation MVP.

## What it does

- Records page navigation.
- Records clicks.
- Records text entry.
- Records normal `<select>` dropdown changes.
- Saves workflows in Chrome local storage.
- Replays a saved workflow in the active tab.
- Exports and imports workflow JSON.
- Opens the existing GitHub Pages AutoFlow dashboard for manual editing.

## Privacy and safety

- The extension does **not** use an AI API.
- Password fields are never recorded.
- Fields that look like passwords, API keys, tokens, card numbers, CVV/CVC, or one-time codes are excluded from recording.
- Recorded clicks whose labels look like Publish, Delete, Send, Submit, Buy, Pay, Purchase, Approve, or similar actions are marked risky.
- Risky clicks require a browser confirmation during replay.

Do not store secrets in workflow JSON.

## Install locally in Chrome

1. Download or clone the repository.
2. Open Chrome.
3. Go to `chrome://extensions/`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the repository's `extension` folder.
7. Pin **AutoFlow Studio Recorder** to the Chrome toolbar.

## First test

1. Open a non-critical test webpage.
2. Click the AutoFlow extension.
3. Enter a workflow name.
4. Click **Start recording**.
5. Interact with the page.
6. Reopen the extension.
7. Click **Stop & save**.
8. Choose the saved workflow.
9. Click **Run workflow**.

## Architecture

```text
Chrome popup
    ↓
Background service worker
    ↓
Content script in active webpage
    ↓
Record / replay page actions
    ↓
Chrome local storage

Existing AutoFlow GitHub Pages dashboard
    ↓
Workflow editing / Playwright generation
```

## Current MVP limits

- Chrome/Chromium browsers only.
- Browser permission is required for pages being automated.
- Some sites use dynamic DOMs, iframes, shadow DOM, CAPTCHAs, or anti-automation controls that may require additional support.
- File upload recording is not included.
- Drag-and-drop, keyboard shortcuts, multi-tab logic, screenshots, assertions, loops, conditions, and variables are planned next.
- Browser internal pages such as `chrome://` cannot be automated.

## Recommended next version

1. Visual recorder overlay.
2. Selector repair / fallback locators.
3. Variables and CSV replay.
4. Conditions and loops.
5. Multi-tab support.
6. Screenshots and assertions.
7. Workflow logs with per-step success/failure.
8. Sync recorded workflows with the GitHub Pages AutoFlow dashboard.
