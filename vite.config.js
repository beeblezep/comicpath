import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
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
