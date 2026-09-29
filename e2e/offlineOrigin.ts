import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const contentTypes: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
}

/** A private origin that can really disappear, independent of browser emulation. */
export async function startOfflineOrigin() {
  // Serve exact build bytes, without Vite preview's development CORS/Vary
  // headers, which would create different cache variants for module requests.
  const server = createServer(async (incoming, outgoing) => {
    try {
      const pathname = decodeURIComponent(new URL(incoming.url ?? '/', 'http://localhost').pathname)
      // Like Cloudflare's asset server, which redirects /index.html to /.
      if (pathname === '/index.html') {
        outgoing.writeHead(307, { Location: '/' })
        outgoing.end()
        return
      }
      const file = resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
      if (!file.startsWith(resolve(dist) + sep)) throw new Error('Outside build')
      const bytes = await readFile(file)
      outgoing.writeHead(200, { 'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream' })
      outgoing.end(bytes)
    } catch {
      outgoing.writeHead(404)
      outgoing.end()
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    async stop() {
      if (!server.listening) return
      const closed = new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve())
      })
      server.closeAllConnections()
      await closed
    },
  }
}
