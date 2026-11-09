/**
 * Render PDF pages to PNG images so the multimodal model can read them
 * directly. This module performs no text extraction or OCR: it only rasterizes
 * pages with the system PDF renderer.
 *
 * Renderer lookup order:
 *   1. `pdftoppm` on PATH (Poppler, also shipped with MiKTeX);
 *   2. a few common Poppler install paths;
 *   3. `gswin64c` / `gs` (Ghostscript) as a fallback.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MAX_PAGES = 6
const DPI = 120
const RENDER_TIMEOUT_MS = 90_000

/** Run one executable and resolve its stdout. */
function run(command, args, timeoutMs = RENDER_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error === null) {
        resolve(stdout)
        return
      }
      const failure = new Error(String(stderr || error.message).trim() || `${command} 执行失败`)
      failure.code = error.code
      reject(failure)
    })
  })
}

/** Candidate absolute Poppler paths for this machine class. */
function popplerCandidates() {
  return [
    'pdftoppm',
    'pdftoppm.exe',
    'pdftocairo',
    'pdftocairo.exe',
    'D:\\miktex\\latex\\miktex\\bin\\x64\\pdftoppm.exe',
    'D:\\miktex\\latex\\miktex\\bin\\x64\\pdftocairo.exe',
    'C:\\Program Files\\poppler\\bin\\pdftoppm.exe',
    'C:\\Program Files (x86)\\poppler\\bin\\pdftoppm.exe',
    'C:\\poppler\\bin\\pdftoppm.exe',
  ]
}

/** Candidate Ghostscript paths. */
function ghostscriptCandidates() {
  return ['gswin64c', 'gswin32c', 'gs']
}

/** Whether the rendered page count is usable. */
function pngPages(names) {
  return names.filter((name) => /^page-\d+\.png$/.test(name)).sort((left, right) => {
    const leftNumber = Number(/(\d+)/.exec(left)?.[1] ?? 0)
    const rightNumber = Number(/(\d+)/.exec(right)?.[1] ?? 0)
    return leftNumber - rightNumber
  })
}

/**
 * Render PDF bytes to ordered PNG page images.
 * @param {Buffer|Uint8Array} bytes
 * @param {{maxPages?: number, dpi?: number, signal?: AbortSignal}} [options]
 * @returns {Promise<{images: {data: Buffer, mediaType: 'image/png', name: string}[], pages: number, truncated: boolean, renderer: string}>}
 */
export async function renderPdfPages(bytes, options = {}) {
  const maxPages = Math.min(MAX_PAGES, Math.max(1, options.maxPages ?? MAX_PAGES))
  const dpi = Math.min(200, Math.max(96, options.dpi ?? DPI))
  const directory = await mkdtemp(join(tmpdir(), 'dsh-health-pdf-'))
  try {
    const input = join(directory, 'input.pdf')
    await writeFile(input, bytes)
    let renderer
    let lastError
    // 1) Poppler (pdftoppm or pdftocairo). Some wrappers return a non-zero
    // status after writing the expected pages, so accept produced files.
    for (const command of popplerCandidates()) {
      try {
        await run(command, ['-png', '-r', String(dpi), '-f', '1', '-l', String(maxPages), input, join(directory, 'page')])
      } catch (error) {
        lastError = error
      }
      if (pngPages(await readdir(directory)).length > 0) {
        renderer = command
        break
      }
    }
    // 2) Ghostscript.
    if (renderer === undefined) {
      for (const command of ghostscriptCandidates()) {
        try {
          await run(command, ['-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=png16m', `-r${dpi}`, '-dFirstPage=1', `-dLastPage=${maxPages}`, `-sOutputFile=${join(directory, 'page-%d.png')}`, input])
        } catch (error) {
          lastError = error
        }
        if (pngPages(await readdir(directory)).length > 0) {
          renderer = command
          break
        }
      }
    }
    if (renderer === undefined) {
      const detail = lastError instanceof Error ? lastError.message : String(lastError ?? '')
      throw new Error(`未找到可用的 PDF 渲染工具（pdftoppm / Ghostscript）。请上传报告截图，或粘贴报告文字。${detail ? `（${detail.slice(0, 180)}）` : ''}`)
    }
    const names = pngPages(await readdir(directory))
    if (names.length === 0) throw new Error('PDF 没有渲染出任何页面，请上传报告截图或粘贴文字')
    const images = []
    for (const name of names) {
      images.push({ data: await readFile(join(directory, name)), mediaType: 'image/png', name: `第 ${images.length + 1} 页` })
    }
    return { images, pages: images.length, truncated: images.length >= maxPages, renderer }
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {})
  }
}
