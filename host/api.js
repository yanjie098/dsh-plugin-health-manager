/**
 * HTTP surface for the health panel. One prefix route on the Harness web server:
 *
 *   POST /health-manager/api              JSON action envelope
 *   POST /health-manager/api/upload       one binary PDF/report upload
 *   GET  /health-manager/api/file/...     archived report download
 *
 * Report recognition is always done by the multimodal model: images are passed
 * through, PDFs are rasterized to page images first. Nothing is written to the
 * history until the user confirms the extracted draft through `record.confirm`.
 */
import { randomUUID } from 'node:crypto'
import { ageFrom, isDateText, localDate, safeFileName } from './store.js'
import { buildIndicator } from './indicators.js'
import { renderPdfPages } from './pdf-images.js'

const JSON_LIMIT = 24 * 1024 * 1024
const MAX_IMAGES = 6
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

/** Read a request body with a hard byte limit. */
async function readBody(req, limit) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) {
      const error = new Error(`请求内容超过上限（${Math.round(limit / 1024 / 1024)} MB）`)
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/** Read and parse a JSON request body. */
async function readJsonBody(req) {
  const buffer = await readBody(req, JSON_LIMIT)
  if (buffer.length === 0) return {}
  try {
    return JSON.parse(buffer.toString('utf8'))
  } catch {
    const error = new Error('请求 JSON 格式错误')
    error.statusCode = 400
    throw error
  }
}

/** Send one JSON response. */
function sendJson(res, status, value) {
  if (res.headersSent) return
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** Same-origin guard for browser callers that send an Origin header. */
function sameOrigin(req) {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin.length === 0) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

/** Resolve a media type for an uploaded buffer from its filename. */
function mediaTypeOf(fileName, declared) {
  const extension = String(fileName).toLowerCase().split('.').at(-1)
  switch (extension) {
    case 'pdf': return 'application/pdf'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    case 'txt':
    case 'md':
    case 'csv': return 'text/plain'
    default: return typeof declared === 'string' && declared.startsWith('image/') ? declared : 'application/octet-stream'
  }
}

/** Person summary used by the panel landing state. */
function summarizePerson(person, records, advice) {
  const checkups = records.filter((record) => record.kind === 'checkup')
  const daily = records.filter((record) => record.kind === 'daily')
  const latest = records.at(-1)
  return {
    id: person.id,
    name: person.name,
    sex: person.sex,
    birthDate: person.birthDate,
    age: ageFrom(person.birthDate),
    heightCm: person.heightCm,
    relation: person.relation,
    notes: person.notes,
    createdAt: person.createdAt,
    recordCount: records.length,
    checkupCount: checkups.length,
    lastCheckup: checkups.at(-1)?.date,
    lastDaily: daily.at(-1)?.date,
    lastRecordAt: latest?.createdAt,
    abnormalLatest: latest?.abnormalCount ?? 0,
    adviceDate: advice?.recordDate,
  }
}

/** Normalize one model-extracted indicator row into a confirm-form row. */
function draftRow(row, person) {
  const indicator = buildIndicator(row.name, row.value, row.unit, row.refLow, row.refHigh, person?.sex === 'female' ? 'female' : person?.sex === 'male' ? 'male' : undefined)
  return {
    key: indicator.key,
    name: indicator.name,
    value: indicator.value,
    unit: indicator.unit,
    ...(indicator.refLow === undefined ? {} : { refLow: indicator.refLow }),
    ...(indicator.refHigh === undefined ? {} : { refHigh: indicator.refHigh }),
    status: indicator.status,
    group: indicator.group,
  }
}

/**
 * Create the Host route handler.
 * @param {object} options
 * @param {import('./store.js').HealthStore} options.store
 * @param {import('./llm.js').HealthAdvisor} options.advisor
 * @param {() => object} options.config
 */
export function createApiHandler({ store, advisor, config }) {
  /** Generate advice for one stored record. */
  const generateAndSave = async (personId, recordId) => {
    const person = await store.getPerson(personId)
    if (person === undefined) throw new Error('成员不存在')
    const records = await store.listRecords(personId)
    const record = records.find((entry) => entry.id === recordId)
    if (record === undefined) throw new Error('记录不存在')
    const advice = await advisor.generateAdvice({ person, record, records })
    await store.saveAdvice(personId, advice)
    return advice
  }

  /**
   * Run model recognition and shape a draft the user must confirm.
   * @param {object} options
   */
  const buildDraft = async ({ personId, date, extraction, source, rawText, warnings }) => {
    const person = await store.getPerson(personId)
    if (person === undefined) throw Object.assign(new Error('成员不存在'), { statusCode: 404 })
    const rows = []
    const unmatched = []
    for (const row of Array.isArray(extraction?.indicators) ? extraction.indicators : []) {
      if (row === null || typeof row !== 'object') continue
      const name = String(row.name ?? '').trim()
      if (name.length === 0) continue
      const normalized = draftRow({ ...row, name }, person)
      rows.push(normalized)
      if (normalized.key.startsWith('custom:')) unmatched.push(name)
    }
    if (unmatched.length > 0) warnings.push(`有 ${unmatched.length} 项指标未匹配内置指标库（将按自定义指标保存）：${unmatched.slice(0, 8).join('、')}`)
    if (rows.length === 0) warnings.push('模型没有提取到结构化指标，你可以手动添加后再保存')
    const reportDate = isDateText(date)
      ? date
      : isDateText(extraction?.reportDate)
        ? extraction.reportDate
        : localDate()
    return {
      draftId: randomUUID(),
      personId,
      kind: 'checkup',
      date: reportDate,
      modelDate: extraction?.reportDate,
      institution: typeof extraction?.institution === 'string' ? extraction.institution.slice(0, 120) : '',
      summary: typeof extraction?.summary === 'string' ? extraction.summary.slice(0, 3000) : '',
      indicators: rows,
      warnings,
      source,
      ...(typeof rawText === 'string' && rawText.length > 0 ? { rawText: rawText.slice(0, 20000) } : {}),
    }
  }

  /** Handle a PDF (or text file) upload: archive and recognize the pages. */
  const handleUpload = async (req, res) => {
    const personId = String(req.headers['x-hm-person'] ?? '')
    const encodedName = String(req.headers['x-hm-filename'] ?? '')
    let fileName = 'report'
    try {
      fileName = safeFileName(decodeURIComponent(encodedName))
    } catch {
      fileName = safeFileName(encodedName)
    }
    if (personId.length === 0) throw Object.assign(new Error('缺少成员参数'), { statusCode: 400 })
    const person = await store.getPerson(personId)
    if (person === undefined) throw Object.assign(new Error('成员不存在'), { statusCode: 404 })
    const maxBytes = Number(config()?.maxUploadBytes) > 0 ? Number(config().maxUploadBytes) : 15 * 1024 * 1024
    const buffer = await readBody(req, maxBytes)
    if (buffer.length === 0) throw Object.assign(new Error('上传的文件为空'), { statusCode: 400 })
    const mime = mediaTypeOf(fileName, req.headers['content-type'])
    const dateHeader = String(req.headers['x-hm-date'] ?? '')
    const date = isDateText(dateHeader) ? dateHeader : undefined
    const stored = await store.saveReportFile(personId, fileName, buffer, date ?? localDate())
    const warnings = []
    let extraction
    let source
    let rawText
    if (mime === 'application/pdf') {
      let rendered
      try {
        rendered = await renderPdfPages(buffer)
      } catch (error) {
        throw Object.assign(new Error(`${error instanceof Error ? error.message : String(error)}\n文件已归档到 reports/。`), { statusCode: 400 })
      }
      if (rendered.truncated) warnings.push(`报告页数较多，只识别了前 ${rendered.pages} 页；其余页如需纳入，请截图补充上传。`)
      extraction = await advisor.extractReport({ images: rendered.images })
      source = { type: 'pdf', fileName: stored.name, reportPath: stored.reportPath, mime }
    } else if (mime.startsWith('image/')) {
      if (!IMAGE_TYPES.has(mime)) throw Object.assign(new Error(`不支持的图片格式：${mime}`), { statusCode: 400 })
      extraction = await advisor.extractReport({ images: [{ data: buffer, mediaType: mime, name: fileName }] })
      source = { type: 'image', fileName: stored.name, reportPath: stored.reportPath, mime }
    } else {
      const text = buffer.toString('utf8')
      if (text.replace(/\s/g, '').length < 40) {
        throw Object.assign(new Error('这个文件看起来不是文本报告。文件已归档，请上传 PDF/图片，或粘贴报告文字。'), { statusCode: 400 })
      }
      rawText = text
      extraction = await advisor.extractReport({ text })
      source = { type: 'file', fileName: stored.name, reportPath: stored.reportPath, mime }
    }
    const draft = await buildDraft({ personId, date, extraction, source, rawText, warnings })
    return sendJson(res, 200, { ok: true, data: { draft } })
  }

  /** Handle archived file download. */
  const handleFile = async (req, res, pathname) => {
    const prefix = '/health-manager/api/file/'
    const rest = decodeURIComponent(pathname.slice(prefix.length))
    const slash = rest.indexOf('/')
    if (slash <= 0) throw Object.assign(new Error('文件路径无效'), { statusCode: 400 })
    const personId = rest.slice(0, slash)
    const relative = rest.slice(slash + 1)
    const file = await store.readReportFile(personId, relative)
    const encoded = encodeURIComponent(file.name)
    res.writeHead(200, {
      'content-type': file.mime,
      'content-length': file.data.length,
      'content-disposition': `inline; filename*=UTF-8''${encoded}`,
      'cache-control': 'private, max-age=300',
    })
    res.end(file.data)
  }

  /** Dispatch one JSON action. */
  const handleAction = async (action, payload, res) => {
    switch (action) {
      case 'state': {
        const people = await store.listPeopleState(summarizePerson)
        let model
        try {
          const route = await advisor.resolveModel()
          model = { provider: route.provider, model: route.model, imageSupported: route.imageSupported }
        } catch (error) {
          model = { error: error instanceof Error ? error.message : String(error) }
        }
        return sendJson(res, 200, { ok: true, data: { dataDir: store.dataDir, today: localDate(), model, people } })
      }
      case 'person.create': {
        const person = await store.createPerson(payload)
        return sendJson(res, 200, { ok: true, data: { person } })
      }
      case 'person.update': {
        if (typeof payload?.id !== 'string') throw Object.assign(new Error('缺少成员 ID'), { statusCode: 400 })
        const person = await store.updatePerson(payload.id, payload)
        return sendJson(res, 200, { ok: true, data: { person } })
      }
      case 'person.delete': {
        if (typeof payload?.id !== 'string') throw Object.assign(new Error('缺少成员 ID'), { statusCode: 400 })
        await store.deletePerson(payload.id)
        return sendJson(res, 200, { ok: true, data: { deleted: true } })
      }
      case 'person.get': {
        if (typeof payload?.id !== 'string') throw Object.assign(new Error('缺少成员 ID'), { statusCode: 400 })
        const person = await store.getPerson(payload.id)
        if (person === undefined) throw Object.assign(new Error('成员不存在'), { statusCode: 404 })
        const records = await store.listRecords(payload.id)
        const advice = await store.latestAdvice(payload.id)
        const model = await advisor.resolveModel().catch(() => undefined)
        return sendJson(res, 200, { ok: true, data: { person, records, advice, model } })
      }
      case 'record.list': {
        if (typeof payload?.personId !== 'string') throw Object.assign(new Error('缺少成员 ID'), { statusCode: 400 })
        const records = await store.listRecords(payload.personId)
        return sendJson(res, 200, { ok: true, data: { records } })
      }
      case 'report.analyzeText': {
        if (typeof payload?.personId !== 'string') throw Object.assign(new Error('缺少成员 ID'), { statusCode: 400 })
        const text = String(payload?.text ?? '').trim()
        if (text.replace(/\s/g, '').length < 40) throw Object.assign(new Error('报告文字太短，请粘贴完整的报告文本'), { statusCode: 400 })
        const extraction = await advisor.extractReport({ text })
        const draft = await buildDraft({
          personId: payload.personId,
          date: payload.date,
          extraction,
          source: { type: 'text' },
          rawText: text,
          warnings: [],
        })
        return sendJson(res, 200, { ok: true, data: { draft } })
      }
      case 'report.analyzeImages': {
        if (typeof payload?.personId !== 'string') throw Object.assign(new Error('缺少成员 ID'), { statusCode: 400 })
        const list = Array.isArray(payload?.images) ? payload.images.slice(0, MAX_IMAGES) : []
        if (list.length === 0) throw Object.assign(new Error('没有收到图片'), { statusCode: 400 })
        const person = await store.getPerson(payload.personId)
        if (person === undefined) throw Object.assign(new Error('成员不存在'), { statusCode: 404 })
        const routes = []
        const warnings = []
        const reportPaths = []
        for (const item of list) {
          const mediaType = String(item?.mediaType ?? '')
          if (!IMAGE_TYPES.has(mediaType)) throw Object.assign(new Error(`不支持的图片格式：${mediaType || '未知'}`), { statusCode: 400 })
          const data = Buffer.from(String(item?.base64 ?? ''), 'base64')
          if (data.length === 0) throw Object.assign(new Error('图片内容为空'), { statusCode: 400 })
          const name = safeFileName(String(item?.name ?? 'report-image.jpg'))
          const stored = await store.saveReportFile(payload.personId, name, data, isDateText(payload?.date) ? payload.date : localDate())
          reportPaths.push(stored.reportPath)
          routes.push({ data, mediaType, name })
        }
        const extraction = await advisor.extractReport({ images: routes })
        const draft = await buildDraft({
          personId: payload.personId,
          date: payload.date,
          extraction,
          source: { type: 'image', fileName: list.length === 1 ? safeFileName(String(list[0]?.name ?? 'report')) : `${list.length} 张报告图片`, reportPath: reportPaths[0], reportPaths, mime: String(list[0]?.mediaType ?? '') },
          warnings,
        })
        return sendJson(res, 200, { ok: true, data: { draft } })
      }
      case 'record.confirm': {
        if (typeof payload?.personId !== 'string') throw Object.assign(new Error('缺少成员 ID'), { statusCode: 400 })
        const indicators = Array.isArray(payload?.indicators) ? payload.indicators : []
        const { person, record } = await store.addRecord(payload.personId, {
          kind: 'checkup',
          date: payload.date,
          indicators,
          summary: payload.summary,
          notes: payload.notes,
          source: payload.source,
          rawText: payload.rawText,
        })
        let advice
        const warnings = []
        if (payload.generateAdvice !== false) {
          try {
            advice = await generateAndSave(person.id, record.id)
          } catch (error) {
            warnings.push(`AI 建议生成失败：${error instanceof Error ? error.message : String(error)}。可稍后在面板中点击「重新生成建议」。`)
          }
        }
        return sendJson(res, 200, { ok: true, data: { person, record, advice, warnings } })
      }
      case 'record.add': {
        if (typeof payload?.personId !== 'string') throw Object.assign(new Error('缺少成员 ID'), { statusCode: 400 })
        const { person, record } = await store.addRecord(payload.personId, {
          kind: payload.kind === 'daily' ? 'daily' : 'checkup',
          date: payload.date,
          indicators: payload.indicators,
          notes: payload.notes,
          source: payload.source ?? { type: 'manual' },
          summary: payload.summary,
        })
        let advice
        const warnings = []
        if (payload.generateAdvice !== false) {
          try {
            advice = await generateAndSave(person.id, record.id)
          } catch (error) {
            warnings.push(`AI 建议生成失败：${error instanceof Error ? error.message : String(error)}`)
          }
        }
        return sendJson(res, 200, { ok: true, data: { person, record, advice, warnings } })
      }
      case 'record.delete': {
        if (typeof payload?.personId !== 'string' || typeof payload?.recordId !== 'string') {
          throw Object.assign(new Error('缺少参数'), { statusCode: 400 })
        }
        await store.deleteRecord(payload.personId, payload.recordId)
        return sendJson(res, 200, { ok: true, data: { deleted: true } })
      }
      case 'advice.generate': {
        if (typeof payload?.personId !== 'string' || typeof payload?.recordId !== 'string') {
          throw Object.assign(new Error('缺少参数'), { statusCode: 400 })
        }
        const advice = await generateAndSave(payload.personId, payload.recordId)
        return sendJson(res, 200, { ok: true, data: { advice } })
      }
      case 'advice.get': {
        if (typeof payload?.personId !== 'string' || typeof payload?.adviceId !== 'string') {
          throw Object.assign(new Error('缺少参数'), { statusCode: 400 })
        }
        const advice = await store.getAdvice(payload.personId, payload.adviceId)
        return sendJson(res, 200, { ok: true, data: { advice } })
      }
      default:
        throw Object.assign(new Error(`未知操作：${String(action)}`), { statusCode: 400 })
    }
  }

  /**
   * The registered route handler.
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  return async function handle(req, res) {
    try {
      if (!sameOrigin(req)) {
        return sendJson(res, 403, { ok: false, error: { message: '跨站请求被拒绝' } })
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      const pathname = url.pathname.replace(/\/+$/, '') || '/'
      if (pathname === '/health-manager/api/upload' && req.method === 'POST') return await handleUpload(req, res)
      if (pathname.startsWith('/health-manager/api/file/') && req.method === 'GET') return await handleFile(req, res, pathname)
      if (pathname === '/health-manager/api' && req.method === 'POST') {
        const body = await readJsonBody(req)
        const action = String(body?.action ?? '')
        return await handleAction(action, body, res)
      }
      if (pathname === '/health-manager/api' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, data: { service: 'health-manager', dataDir: store.dataDir } })
      }
      return sendJson(res, 404, { ok: false, error: { message: '未知路径' } })
    } catch (error) {
      const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500
      const message = error instanceof Error ? error.message : String(error)
      return sendJson(res, statusCode, { ok: false, error: { message } })
    }
  }
}
