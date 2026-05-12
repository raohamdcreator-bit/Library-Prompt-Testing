// api-server.js  — local dev only, mimics Vercel serverless functions
import express from 'express';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

// Load .env manually (Vite handles this for frontend, we need it for the API)
import { config } from 'dotenv';
config({ path: '.env.local' });

const app = express();
app.use(express.json());

// ── Mount your API handlers ───────────────────────────────────────────────────
// Dynamically import each handler and wire it to Express

async function mountRoutes() {
    const { default: requestUpload } = await import('./api/video/request-upload.js');

    app.options('/api/video/request-upload', (req, res) => res.status(200).end());
    app.post('/api/video/request-upload', (req, res) => requestUpload(req, res));

    // Add more API routes here as you create them:
    // const { default: anotherHandler } = await import('./api/something.js');
    // app.all('/api/something', (req, res) => anotherHandler(req, res));
}

mountRoutes().then(() => {
    app.listen(3001, () => {
        console.log('✅ API server running at http://localhost:3001');
    });
}).catch(err => {
    console.error('❌ Failed to start API server:', err);
    process.exit(1);
});