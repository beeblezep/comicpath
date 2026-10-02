import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Runs the Vercel function in api/claude.js on the dev server, since it
// executes SDK code rather than just forwarding like the proxies below.
function claudeDevApi(env) {
  return {
    name: 'claude-dev-api',
    configureServer(server) {
      for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_WORKSPACE_ID', 'CLAUDE_MODEL']) {
        if (env[key] && !process.env[key]) process.env[key] = env[key]
      }
      server.middlewares.use('/api/claude', async (req, res) => {
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (body) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const raw = Buffer.concat(chunks).toString()
          try {
            req.body = raw ? JSON.parse(raw) : {}
          } catch {
            return res.status(400).json({ error: 'Invalid JSON body' })
          }
          const { default: handler } = await server.ssrLoadModule('/api/claude.js')
          await handler(req, res)
        } catch (err) {
          res.status(500).json({ error: err.message })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), claudeDevApi(env)],
    server: {
      proxy: {
        '/api/groq': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/groq/, ''),
          headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
          },
        },
        '/api/comicvine': {
          target: 'https://comicvine.gamespot.com/api',
          changeOrigin: true,
          rewrite: (path) => {
            const rewritten = path.replace(/^\/api\/comicvine/, '');
            const sep = rewritten.includes('?') ? '&' : '?';
            return `${rewritten}${sep}api_key=${env.COMICVINE_API_KEY}&format=json`;
          },
        },
      },
    },
  }
})
