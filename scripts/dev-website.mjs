import { createServer } from 'vite'

let webServer
let websiteServer

async function closeServers() {
  await Promise.allSettled([websiteServer?.close(), webServer?.close()])
}

async function shutdown() {
  await closeServers()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

try {
  webServer = await createServer({
    configFile: 'web/vite.config.mts',
    server: { open: false },
  })
  await webServer.listen()

  websiteServer = await createServer({ configFile: 'website/vite.config.mts' })
  await websiteServer.listen()
  websiteServer.printUrls()
} catch (error) {
  await closeServers()
  throw error
}
