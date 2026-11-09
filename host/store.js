/**
 * Lightweight local health store.
 *
 * Every person owns one folder with exactly one health JSON file plus archived
 * original reports:
 *
 *   <root>/<personId>/health.json   profile + every record + generated advice
 *   <root>/<personId>/reports/      archived checkup files (Pdf/images)
 *
 * `health.json` is the single source of truth; folders are created lazily and
 * every write is serialized and atomic. Only node builtins are used.
 */
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { buildIndicator, deriveIndicators, systemsOf } from './indicators.js'

const HEALTH_FILE = 'health.json'
const ID_PATTERN = /^p_[0-9a-f]{8,16}$/
const RECORD_ID_PATTERN = /^r_[0-9a-z]{6,32}$/
const ADVICE_ID_PATTERN = /^a_[0-9a-z]{6,32}$/
const MAX_ADVICES = 40

/** Local calendar date as YYYY-MM-DD. */
export function localDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Local ISO-like timestamp. */
export function localTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Reject anything that is not a plain calendar date. */
export function isDateText(text) {
  return typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text))
}

/** Age in whole years from a birth date, or undefined. */
export function ageFrom(birthDate, now = new Date()) {
  if (!isDateText(birthDate)) return undefined
  const birth = new Date(`${birthDate}T00:00:00`)
  let age = now.getFullYear() - birth.getFullYear()
  const month = now.getMonth() - birth.getMonth()
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1
  return age >= 0 && age < 150 ? age : undefined
}

/** Short random identifier. */
function shortId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 10)}`
}

/** Remove characters Windows forbids in file names and bound the length. */
export function safeFileName(name) {
  const cleaned = String(name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
  return cleaned.length === 0 ? 'report' : cleaned.slice(0, 60)
}

/** Atomically replace a JSON file. */
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}

/** Read a JSON file, returning undefined when missing or unreadable. */
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

/** Serialize writes so concurrent API calls cannot interleave updates. */
class Mutex {
  constructor() {
    this.tail = Promise.resolve()
  }

  /** Run one task after every earlier task settled. */
  run(task) {
    const next = this.tail.then(task, task)
    this.tail = next.catch(() => {})
    return next
  }
}

/** The one folder + one JSON file per person. */
export class HealthStore {
  /** @param {string} dataDir absolute data root */
  constructor(dataDir) {
    this.dataDir = resolve(dataDir)
    this.mutex = new Mutex()
  }

  /** Create the data root. */
  async init() {
    await mkdir(this.dataDir, { recursive: true })
    return this.dataDir
  }

  /** Absolute directory of one person. */
  personDir(personId) {
    if (!ID_PATTERN.test(personId)) throw new Error('无效的成员 ID')
    return join(this.dataDir, personId)
  }

  /** Resolve a path inside the person directory, refusing traversal. */
  resolveInside(personId, relative) {
    const base = this.personDir(personId)
    const target = resolve(base, String(relative ?? ''))
    if (target !== base && !target.startsWith(`${base}${sep}`)) throw new Error('非法的文件路径')
    return target
  }

  /** Absolute path of one person's health JSON. */
  healthPath(personId) {
    return join(this.personDir(personId), HEALTH_FILE)
  }

  /** Read one person's whole health document, or undefined. */
  async readHealth(personId) {
    const health = await readJson(this.healthPath(personId))
    if (health === undefined || health.person === undefined || health.person.id !== personId) return undefined
    if (!Array.isArray(health.records)) health.records = []
    if (!Array.isArray(health.advices)) health.advices = []
    return health
  }

  /** Persist one health document. */
  async writeHealth(personId, health) {
    health.updatedAt = localTimestamp()
    await writeJson(this.healthPath(personId), health)
    return health
  }

  /** List every stored person profile. */
  async listPeople() {
    let entries = []
    try {
      entries = await readdir(this.dataDir, { withFileTypes: true })
    } catch {
      return []
    }
    const people = []
    for (const entry of entries) {
      if (!entry.isDirectory() || !ID_PATTERN.test(entry.name)) continue
      const health = await this.readHealth(entry.name)
      if (health !== undefined) people.push(health.person)
    }
    people.sort((left, right) => String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')))
    return people
  }

  /** Read one profile, or undefined. */
  async getPerson(personId) {
    if (!ID_PATTERN.test(String(personId))) return undefined
    return (await this.readHealth(personId))?.person
  }

  /** Create a person folder holding one empty health JSON. */
  async createPerson(input) {
    return await this.mutex.run(async () => {
      const name = String(input?.name ?? '').trim()
      if (name.length === 0) throw new Error('请填写成员姓名')
      if (name.length > 40) throw new Error('姓名过长')
      const existing = await this.listPeople()
      if (existing.some((person) => person.name === name)) throw new Error(`已存在名为「${name}」的成员`)
      const id = `p_${randomUUID().replace(/-/g, '').slice(0, 10)}`
      const now = new Date()
      const person = {
        id,
        name,
        sex: input?.sex === 'female' ? 'female' : input?.sex === 'male' ? 'male' : 'unknown',
        birthDate: isDateText(input?.birthDate) ? input.birthDate : '',
        heightCm: Number.isFinite(Number(input?.heightCm)) && Number(input.heightCm) > 50 ? Number(input.heightCm) : undefined,
        relation: String(input?.relation ?? '').trim().slice(0, 20),
        notes: String(input?.notes ?? '').trim().slice(0, 500),
        createdAt: localTimestamp(now),
        updatedAt: localTimestamp(now),
      }
      await mkdir(join(this.dataDir, id, 'reports'), { recursive: true })
      await writeJson(this.healthPath(id), { version: 1, person, records: [], advices: [], updatedAt: localTimestamp(now) })
      return person
    })
  }

  /** Update mutable profile fields. */
  async updatePerson(personId, patch) {
    return await this.mutex.run(async () => {
      const health = await this.readHealth(personId)
      if (health === undefined) throw new Error('成员不存在')
      const person = health.person
      if (typeof patch?.name === 'string' && patch.name.trim().length > 0) {
        const name = patch.name.trim().slice(0, 40)
        const people = await this.listPeople()
        if (people.some((entry) => entry.id !== personId && entry.name === name)) throw new Error(`已存在名为「${name}」的成员`)
        person.name = name
      }
      if (patch?.sex === 'male' || patch?.sex === 'female' || patch?.sex === 'unknown') person.sex = patch.sex
      if (typeof patch?.birthDate === 'string') person.birthDate = isDateText(patch.birthDate) ? patch.birthDate : ''
      if (patch?.heightCm === null || patch?.heightCm === '' || patch?.heightCm === undefined) {
        person.heightCm = undefined
      } else if (Number.isFinite(Number(patch.heightCm)) && Number(patch.heightCm) > 50) {
        person.heightCm = Number(patch.heightCm)
      }
      if (typeof patch?.relation === 'string') person.relation = patch.relation.trim().slice(0, 20)
      if (typeof patch?.notes === 'string') person.notes = patch.notes.trim().slice(0, 500)
      person.updatedAt = localTimestamp()
      await this.writeHealth(personId, health)
      return person
    })
  }

  /** Delete a person folder. */
  async deletePerson(personId) {
    return await this.mutex.run(async () => {
      await rm(this.personDir(personId), { recursive: true, force: true })
      return true
    })
  }

  /** Records sorted by date then creation time, oldest first. */
  async listRecords(personId) {
    const health = await this.readHealth(personId)
    return health?.records ?? []
  }

  /**
   * Append one record, deriving BMI/HOMA-IR and other computable metrics first.
   * @param {string} personId
   * @param {object} input
   * @param {'checkup'|'daily'} input.kind
   * @param {string} [input.date]
   * @param {Array<object>} [input.indicators]
   * @param {string} [input.notes]
   * @param {object} [input.source]
   * @param {string} [input.summary]
   * @param {string} [input.rawText]
   */
  async addRecord(personId, input) {
    return await this.mutex.run(async () => {
      const health = await this.readHealth(personId)
      if (health === undefined) throw new Error('成员不存在')
      const person = health.person
      const kind = input?.kind === 'daily' ? 'daily' : 'checkup'
      const date = isDateText(input?.date) ? input.date : localDate()
      const sex = person.sex === 'female' ? 'female' : person.sex === 'male' ? 'male' : undefined
      const rows = Array.isArray(input?.indicators) ? input.indicators : []
      /** @type {object[]} */
      const indicators = []
      for (const row of rows) {
        if (row === null || typeof row !== 'object') continue
        const name = String(row.name ?? row.key ?? '').trim()
        if (name.length === 0) continue
        if (row.value === undefined || row.value === null || String(row.value).trim().length === 0) continue
        indicators.push(rowFromForm(row, sex))
      }
      // Height measured by a checkup becomes the profile height.
      const measuredHeight = indicators.find((indicator) => indicator.key === 'height_cm')
      if (measuredHeight !== undefined && typeof measuredHeight.value === 'number' && measuredHeight.value > 50) {
        person.heightCm = measuredHeight.value
        person.updatedAt = localTimestamp()
      } else if (kind === 'checkup' && typeof person.heightCm === 'number' && person.heightCm > 50) {
        // Keep the profile height inside the record so BMI and waist/height are computable.
        indicators.push(buildIndicator('height_cm', person.heightCm, 'cm', undefined, undefined, sex))
      }
      deriveIndicators(indicators, person)
      const now = new Date()
      const record = {
        id: shortId('r'),
        kind,
        date,
        createdAt: localTimestamp(now),
        updatedAt: localTimestamp(now),
        ...(typeof input?.notes === 'string' && input.notes.trim().length > 0 ? { notes: input.notes.trim().slice(0, 2000) } : {}),
        ...(typeof input?.summary === 'string' && input.summary.trim().length > 0 ? { summary: input.summary.trim().slice(0, 3000) } : {}),
        ...(input?.source !== undefined && input.source !== null ? { source: input.source } : {}),
        ...(typeof input?.rawText === 'string' && input.rawText.trim().length > 0 ? { rawText: input.rawText.trim().slice(0, 20000) } : {}),
        indicators,
        abnormalCount: indicators.filter((indicator) => indicator.status === 'high' || indicator.status === 'low' || indicator.status === 'abnormal').length,
        systems: systemsOf(indicators),
      }
      health.records.push(record)
      health.records.sort((left, right) => {
        const byDate = String(left.date ?? '').localeCompare(String(right.date ?? ''))
        return byDate !== 0 ? byDate : String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? ''))
      })
      await this.writeHealth(personId, health)
      return { person, record }
    })
  }

  /** Delete one record and the advice generated for it. */
  async deleteRecord(personId, recordId) {
    return await this.mutex.run(async () => {
      if (!RECORD_ID_PATTERN.test(String(recordId))) throw new Error('无效的记录 ID')
      const health = await this.readHealth(personId)
      if (health === undefined) throw new Error('成员不存在')
      const index = health.records.findIndex((record) => record.id === recordId)
      if (index < 0) throw new Error('记录不存在')
      const [removed] = health.records.splice(index, 1)
      health.advices = health.advices.filter((advice) => advice.recordId !== recordId)
      if (removed?.source?.reportPath !== undefined) {
        await rm(this.resolveInside(personId, removed.source.reportPath), { force: true }).catch(() => {})
      }
      for (const path of removed?.source?.reportPaths ?? []) {
        if (typeof path === 'string') await rm(this.resolveInside(personId, path), { force: true }).catch(() => {})
      }
      await this.writeHealth(personId, health)
      return true
    })
  }

  /** Append one generated advice document and attach it to its record. */
  async saveAdvice(personId, advice) {
    return await this.mutex.run(async () => {
      const health = await this.readHealth(personId)
      if (health === undefined) throw new Error('成员不存在')
      const stored = { ...advice, id: ADVICE_ID_PATTERN.test(String(advice?.id)) ? advice.id : shortId('a'), personId }
      health.advices.push(stored)
      health.advices.sort((left, right) => String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')))
      if (health.advices.length > MAX_ADVICES) health.advices = health.advices.slice(-MAX_ADVICES)
      const record = health.records.find((entry) => entry.id === stored.recordId)
      if (record !== undefined) {
        record.adviceId = stored.id
        record.updatedAt = localTimestamp()
      }
      await this.writeHealth(personId, health)
      return stored
    })
  }

  /** Read one advice document. */
  async getAdvice(personId, adviceId) {
    if (!ADVICE_ID_PATTERN.test(String(adviceId))) return undefined
    return (await this.readHealth(personId))?.advices.find((advice) => advice.id === adviceId)
  }

  /** Read the latest advice stored for a person. */
  async latestAdvice(personId) {
    return (await this.readHealth(personId))?.advices.at(-1)
  }

  /** Archive one uploaded report file and return its stored metadata. */
  async saveReportFile(personId, originalName, bytes, date) {
    const health = await this.readHealth(personId)
    if (health === undefined) throw new Error('成员不存在')
    const directory = this.personDir(personId)
    await mkdir(join(directory, 'reports'), { recursive: true })
    const base = safeFileName(originalName)
    const extensionIndex = base.lastIndexOf('.')
    const extension = extensionIndex > 0 ? base.slice(extensionIndex).toLowerCase() : ''
    const stem = extensionIndex > 0 ? base.slice(0, extensionIndex) : base
    const folderDate = isDateText(date) ? date : localDate()
    let candidate = `${folderDate}_${stem}${extension}`
    let counter = 1
    while (existsSync(join(directory, 'reports', candidate))) {
      counter += 1
      candidate = `${folderDate}_${stem}-${counter}${extension}`
    }
    await writeFile(join(directory, 'reports', candidate), bytes)
    return {
      reportPath: `reports/${candidate}`,
      fileName: candidate,
      originalName: base,
      bytes: bytes.length,
      mime: guessMime(candidate),
    }
  }

  /** Read an archived report for download. */
  async readReportFile(personId, relative) {
    const absolute = this.resolveInside(personId, relative)
    const info = await stat(absolute)
    if (!info.isFile()) throw new Error('文件不存在')
    return { data: await readFile(absolute), name: relative.split('/').at(-1) ?? 'report', mime: guessMime(absolute) }
  }

  /**
   * Summarize every person for the panel landing state.
   * @param {(person: object, records: object[], advice: object|undefined) => object} summarize
   */
  async listPeopleState(summarize) {
    const people = await this.listPeople()
    const result = []
    for (const person of people) {
      const health = await this.readHealth(person.id)
      result.push(summarize(health.person, health.records, health.advices.at(-1)))
    }
    return result
  }
}

/** Build one canonical indicator row from a form/API row. */
function rowFromForm(row, sex) {
  const built = buildIndicator(row.key ?? row.name, row.value, row.unit, row.refLow, row.refHigh, sex)
  // Keep a client-supplied canonical name/key for custom indicators.
  if (typeof row.key === 'string' && row.key.startsWith('custom:') && typeof row.name === 'string' && row.name.trim().length > 0) {
    built.key = row.key
    built.name = row.name.trim()
  }
  return built
}

/** Guess a content type from a file extension. */
export function guessMime(path) {
  const extension = String(path).toLowerCase().split('.').at(-1)
  switch (extension) {
    case 'pdf': return 'application/pdf'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    case 'txt': return 'text/plain; charset=utf-8'
    case 'md': return 'text/markdown; charset=utf-8'
    case 'json': return 'application/json'
    case 'csv': return 'text/csv; charset=utf-8'
    default: return 'application/octet-stream'
  }
}
