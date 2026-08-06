<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bc46c050-de8a-410f-a7b0-264cb2db079f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local`, then set `GEMINI_API_KEY` to your Gemini API key. For a deployed app, configure `GEMINI_API_KEY` as an environment variable on the hosting platform.
3. Run the app:
   `npm run dev`

## Persistent player accounts

Set `DATABASE_URL` to a PostgreSQL connection string in the deployment environment.
The server automatically creates the `olympia_accounts` table. Without this variable,
accounts are stored in `data/accounts.json`, which is suitable for local development
but will be lost when an ephemeral container is redeployed.
