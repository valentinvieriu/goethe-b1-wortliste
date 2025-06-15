import sharp from 'sharp'
import { parentPort } from 'node:worker_threads'
import { promises as fs } from 'node:fs'

parentPort.on('message', async msg => {
  try {
    switch (msg.action) {
      case 'crop': {
        const { imagePath, x, y, width, height, outputPath } = msg
        await sharp(imagePath).extract({ left: x, top: y, width, height }).toFile(outputPath)
        parentPort.postMessage(outputPath)
        break
      }

      case 'annotate': {
        const { imagePath, outputPath, rectangles } = msg
        const base = sharp(await fs.readFile(imagePath))
        const overlays = await Promise.all(
          rectangles.map(async r => ({
            input: await sharp({
              create: {
                width: r.x1 - r.x0,
                height: r.y1 - r.y0,
                channels: 4,
                background: { r: 255, g: 0, b: 0, alpha: 0.2 },
              },
            })
              .png()
              .toBuffer(),
            left: r.x0,
            top: r.y0,
            blend: 'over',
          })),
        )

        const tmp = `${outputPath}.tmp`
        await base.composite(overlays).toFile(tmp)
        await fs.rename(tmp, outputPath)
        parentPort.postMessage(outputPath)
        break
      }

      default:
        throw new Error(`Unknown action: ${msg.action}`)
    }
  } catch (err) {
    parentPort.postMessage({ error: err.message })
  }
})
