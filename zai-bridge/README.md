# AutoFlow Z.AI Bridge

This local bridge lets the GitHub Pages version of AutoFlow Studio use Z.AI without exposing your API key in browser JavaScript.

## What it does

1. AutoFlow Studio sends your plain-language automation request to `http://127.0.0.1:8787`.
2. This bridge sends the request to the Z.AI Chat Completions API.
3. Z.AI returns AutoFlow workflow JSON.
4. AutoFlow imports the generated steps so you can review, edit, validate, export, and run them.

The bridge **generates workflow definitions only**. It does not execute browser actions.

## Requirements

- Node.js 18 or newer
- A Z.AI API key

## Windows setup

```powershell
cd zai-bridge
Copy-Item .env.example .env
notepad .env
```

Put your API key in:

```text
ZAI_API_KEY=your-real-key
```

Then run:

```powershell
npm start
```

You should see:

```text
AutoFlow Z.AI bridge listening at http://127.0.0.1:8787
```

Open AutoFlow Studio, choose **AI Assist**, click **Test bridge**, describe a task, and click **Generate workflow with Z.AI**.

## Configuration

```text
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
ZAI_MODEL=glm-5.3
ZAI_REASONING_EFFORT=low
PORT=8787
```

For harder workflow-planning requests, change `ZAI_REASONING_EFFORT` to `high` or `max`.

## Security

- Never place your real API key in `index.html`, `app.js`, workflow JSON, CSV files, or GitHub commits.
- Keep `.env` local.
- The server binds only to `127.0.0.1`.
- CORS is limited to the AutoFlow GitHub Pages origin and local development origins.
- Generated workflows still require your review before execution.
