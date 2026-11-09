/**
 * Model-facing health work: report structuring and longevity-framework advice.
 *
 * Every risk and suggestion is generated against the 《长寿管理》 framework in
 * `longevity.js`. The Harness Host `llm` service supplies the model route, and
 * data sent to it is de-identified: age, sex, height, indicators and trends,
 * never the person's name.
 */
import { ageFrom, localDate, localTimestamp } from './store.js'
import { describeIndicators, formatRange, formatValue, seriesOf } from './indicators.js'
import { SYSTEMS, frameworkText } from './longevity.js'

const ADVICE_SYSTEM = `你是「长寿管理」体系的健康顾问。你的所有风险判断和建议必须基于下面给出的《长寿管理》框架：从 12 个身体系统出发解读体检与日常数据，指出哪些系统需要关注、为什么，并给出可执行的饮食、健身与补充监测建议。不得编造用户没有提供的数据；不做疾病诊断；风险提示使用「提示/建议就医确认」的措辞，并说明建议不能替代医生。

${frameworkText()}

输出要求：只输出一个 JSON 对象，不要 markdown 代码块，不要任何解释文字。结构：
{"summary":"一句话总体结论","overallRiskLevel":"high|medium|low","systems":[{"system":"框架中的系统名，例如 代谢失衡系统","status":"关注|正常|数据不足","finding":"基于本次数据的解读，引用具体指标数值","advice":"该系统对应的改善方向"}],"risks":[{"level":"high|medium|low","system":"系统名","title":"","detail":""}],"diet":[{"title":"","detail":""}],"fitness":[{"title":"","detail":""}],"monitoring":[{"title":"","detail":""}],"trend":["..."]}
规则：
- systems 只列出与本次数据相关的系统（1–6 个）；status 为「数据不足」表示缺少该系统的关键指标，应在 monitoring 中建议补测；
- risks 1–5 条，必须对应具体指标和系统，level 反映紧迫程度；
- diet 3–6 条、fitness 3–6 条，具体可执行（食物种类与份量方向、运动类型/频率/时长/强度）；
- monitoring 1–4 条，基于框架的三级监测体系，指出下次应补充的检查或日常追踪项；
- trend 1–3 条本次与历史对比的解读；没有历史数据时写「首次记录，暂无趋势」；
- 全部使用简体中文；不要输出 JSON 以外的内容。`

const EXTRACT_SYSTEM = `你是体检报告结构化助手。从用户提供的报告文本或图片中提取体检日期、体检机构和所有可识别的检验指标。只输出一个 JSON 对象，不要 markdown 代码块，不要解释：
{"reportDate":"YYYY-MM-DD 或空字符串","institution":"体检机构或空字符串","indicators":[{"name":"报告中的指标名称","value":"数值或文字结果","unit":"单位或空字符串","refLow":数字或null,"refHigh":数字或null}],"summary":"报告结论或异常提示摘要"}
要求：
- name 保留报告原文（可去掉多余空格），不要翻译；value 数字优先，不带单位；文字结果（如"阴性"）照抄；
- refLow/refHigh 取报告给出的参考区间；报告没给就填 null，不要编造；
- 尽量提取全部表格项目：血常规、尿常规、肝功能、肾功能、血脂、血糖、甲状腺、炎症、免疫、维生素、体测等，不要漏项；
- 只输出 JSON。`

/** Strip a markdown fence and parse the first JSON object in text. */
export function parseModelJson(text) {
  if (typeof text !== 'string') return undefined
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // fall through
  }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return undefined
    }
  }
  return undefined
}

/** Keep one advice item shaped and bounded. */
function adviceItem(value, maxTitle = 40, maxDetail = 800) {
  if (value === null || typeof value !== 'object') return undefined
  const title = String(value.title ?? '').trim()
  const detail = String(value.detail ?? '').trim()
  if (title.length === 0 && detail.length === 0) return undefined
  return { title: (title || detail).slice(0, maxTitle), detail: detail.slice(0, maxDetail) }
}

const LEVELS = new Set(['high', 'medium', 'low'])
const STATUSES = new Set(['关注', '正常', '数据不足'])

/** Normalize a generated advice document; undefined when nothing usable. */
export function normalizeAdvice(value) {
  if (value === null || typeof value !== 'object') return undefined
  const list = (items, mapper, limit, maxTitle, maxDetail) => (Array.isArray(items)
    ? items.map(mapper).filter(Boolean).slice(0, limit)
    : [])
  const diet = list(value.diet, (item) => adviceItem(item), 8)
  const fitness = list(value.fitness, (item) => adviceItem(item), 8)
  const monitoring = list(value.monitoring, (item) => adviceItem(item, 40, 600), 6)
  const risks = list(value.risks, (item) => {
    const base = adviceItem(item, 40, 600)
    if (base === undefined) return undefined
    const level = LEVELS.has(item?.level) ? item.level : 'medium'
    return { ...base, level, ...(typeof item?.system === 'string' && item.system.trim().length > 0 ? { system: item.system.trim().slice(0, 40) } : {}) }
  }, 8)
  const systems = list(value.systems, (item) => {
    if (item === null || typeof item !== 'object') return undefined
    const system = String(item.system ?? '').trim()
    if (system.length === 0) return undefined
    return {
      system: system.slice(0, 40),
      status: STATUSES.has(item.status) ? item.status : '关注',
      finding: String(item.finding ?? '').trim().slice(0, 600),
      advice: String(item.advice ?? '').trim().slice(0, 600),
    }
  }, 8)
  const trend = Array.isArray(value.trend) ? value.trend.map((item) => String(item).trim()).filter((item) => item.length > 0).slice(0, 5) : []
  const summary = String(value.summary ?? '').trim().slice(0, 500)
  const overallRiskLevel = LEVELS.has(value.overallRiskLevel) ? value.overallRiskLevel : (risks.some((risk) => risk.level === 'high') ? 'high' : risks.length > 0 ? 'medium' : 'low')
  if (diet.length === 0 && fitness.length === 0 && risks.length === 0 && systems.length === 0 && trend.length === 0 && summary.length === 0) return undefined
  return { summary, overallRiskLevel, systems, risks, diet, fitness, monitoring, trend }
}

/** Minutes-level trend digest of one key across records. */
function trendText(records, key, label, unit, limit = 6) {
  const points = seriesOf(records, key).slice(-limit)
  if (points.length === 0) return ''
  return `${label}：${points.map((point) => `${point.date} ${point.value}${unit}`).join('，')}`
}

/** Build the de-identified user payload for advice generation. */
export function buildAdvicePayload(person, record, records) {
  const age = ageFrom(person?.birthDate)
  const sexText = person?.sex === 'female' ? '女' : person?.sex === 'male' ? '男' : '未提供'
  const earlier = (Array.isArray(records) ? records : []).filter((entry) => entry.id !== record.id && String(entry.date) <= String(record.date))
  const lines = []
  lines.push('请基于《长寿管理》框架，对以下数据生成健康风险与建议。')
  lines.push('')
  lines.push('【基本信息】')
  lines.push(`性别：${sexText}${age === undefined ? '' : `；年龄：${age} 岁`}${person?.heightCm === undefined ? '' : `；身高：${person.heightCm} cm`}`)
  lines.push('')
  lines.push(`【本次${record.kind === 'daily' ? '日常记录' : '体检'}】日期：${record.date}`)
  if (record.indicators?.length > 0) lines.push(`指标：${describeIndicators(record.indicators)}`)
  if (typeof record.summary === 'string' && record.summary.length > 0) lines.push(`本次小结：${record.summary.slice(0, 2000)}`)
  if (typeof record.notes === 'string' && record.notes.length > 0) lines.push(`备注：${record.notes.slice(0, 800)}`)
  if (!record.indicators?.length && typeof record.rawText === 'string' && record.rawText.length > 0) {
    lines.push(`报告原文（节选）：${record.rawText.slice(0, 4000)}`)
  }
  lines.push('')
  lines.push('【历史趋势】（由早到晚）')
  const trendLines = [
    trendText(earlier, 'weight_kg', '体重', 'kg'),
    trendText(earlier, 'waist_cm', '腰围', 'cm'),
    trendText(earlier, 'sbp', '收缩压', 'mmHg'),
    trendText(earlier, 'dbp', '舒张压', 'mmHg'),
    trendText(earlier, 'fasting_glucose', '空腹血糖', 'mmol/L'),
    trendText(earlier, 'hba1c', '糖化血红蛋白', '%'),
    trendText(earlier, 'ldl_c', 'LDL-C', 'mmol/L'),
    trendText(earlier, 'apob', 'ApoB', 'g/L'),
    trendText(earlier, 'hs_crp', 'hs-CRP', 'mg/L'),
    trendText(earlier, 'alt', 'ALT', 'U/L'),
    trendText(earlier, 'uric_acid', '尿酸', 'μmol/L'),
    trendText(earlier, 'hgb', '血红蛋白', 'g/L'),
    trendText(earlier, 'grip_kg', '握力', 'kg'),
    trendText(earlier, 'sleep_hours', '睡眠', '小时'),
  ].filter((line) => line.length > 0)
  if (trendLines.length === 0) lines.push('（暂无历史记录，本次是第一次记录）')
  else lines.push(...trendLines)
  const previous = earlier.at(-1)
  if (previous !== undefined) {
    lines.push('')
    lines.push(`【上一次记录】日期：${previous.date}`)
    if (previous.indicators?.length > 0) lines.push(`指标：${describeIndicators(previous.indicators).slice(0, 3000)}`)
  }
  const systemNames = new Set()
  for (const indicator of record.indicators ?? []) for (const key of indicator.systems ?? []) systemNames.add(key)
  if (systemNames.size > 0) {
    const names = SYSTEMS.filter((system) => systemNames.has(system.key)).map((system) => system.name)
    lines.push('')
    lines.push(`【本次数据涉及的框架系统】${names.join('、')}`)
  }
  return lines.join('\n')
}

/** Render a plain-text advice document for chat tool results. */
export function adviceToText(advice) {
  if (advice === undefined) return '（暂无建议）'
  const levelText = (level) => (level === 'high' ? '高' : level === 'medium' ? '中' : '低')
  const lines = []
  if (advice.summary) lines.push(`结论（总体风险 ${levelText(advice.overallRiskLevel)}）：${advice.summary}`)
  if (advice.systems?.length) {
    lines.push('系统评估：')
    for (const system of advice.systems) lines.push(`- ${system.system}［${system.status}］${system.finding}${system.advice ? `；建议：${system.advice}` : ''}`)
  }
  if (advice.risks?.length) {
    lines.push('健康风险提示：')
    for (const risk of advice.risks) lines.push(`- [${levelText(risk.level)}]${risk.system ? `${risk.system}：` : ''}${risk.title}——${risk.detail}`)
  }
  if (advice.diet?.length) {
    lines.push('饮食建议：')
    for (const item of advice.diet) lines.push(`- ${item.title}：${item.detail}`)
  }
  if (advice.fitness?.length) {
    lines.push('健身建议：')
    for (const item of advice.fitness) lines.push(`- ${item.title}：${item.detail}`)
  }
  if (advice.monitoring?.length) {
    lines.push('建议补充的监测：')
    for (const item of advice.monitoring) lines.push(`- ${item.title}：${item.detail}`)
  }
  if (advice.trend?.length) {
    lines.push('趋势解读：')
    for (const item of advice.trend) lines.push(`- ${item}`)
  }
  return lines.join('\n')
}

/** Model-facing health operations bound to the live Harness services. */
export class HealthAdvisor {
  /**
   * @param {object} options
   * @param {() => object | undefined} options.getLlm
   * @param {() => object | undefined} options.getDefaultModel
   * @param {() => object | undefined} options.getAttachments
   * @param {() => number} options.timeoutMs
   * @param {() => {provider?: string, model?: string}} options.modelOverride
   */
  constructor(options) {
    this.getLlm = options.getLlm
    this.getDefaultModel = options.getDefaultModel
    this.getAttachments = options.getAttachments
    this.timeoutMs = options.timeoutMs
    this.modelOverride = options.modelOverride
    this.resolved = undefined
  }

  /** Resolve the model route and whether it accepts images. */
  async resolveModel() {
    if (this.resolved !== undefined) return this.resolved
    const llm = this.getLlm()
    if (llm === undefined) throw new Error('当前 Harness 未提供模型服务，无法生成 AI 建议')
    const override = this.modelOverride()
    let provider
    let model
    if (typeof override?.provider === 'string' && override.provider.length > 0 && typeof override?.model === 'string' && override.model.length > 0) {
      provider = override.provider
      model = override.model
    } else {
      const selection = this.getDefaultModel()?.currentSelection?.()
      if (selection === undefined || typeof selection.provider !== 'string' || typeof selection.model !== 'string') {
        throw new Error('没有可用的默认模型，请在模型设置中选择一个模型')
      }
      provider = selection.provider
      model = selection.model
    }
    let imageSupported = false
    try {
      const info = await llm.resolveModelInfo(provider, model)
      imageSupported = (info?.inputModalities ?? []).includes('image')
    } catch {
      imageSupported = false
    }
    this.resolved = { provider, model, imageSupported }
    return this.resolved
  }

  /** Stream one completion and return its concatenated text. */
  async complete({ system, user, images, maxTokens = 3000, signal }) {
    const llm = this.getLlm()
    if (llm === undefined) throw new Error('当前 Harness 未提供模型服务')
    const route = await this.resolveModel()
    const controller = new AbortController()
    const onAbort = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', onAbort, { once: true })
    const timeout = setTimeout(() => controller.abort(new Error('模型请求超时')), Math.max(5000, this.timeoutMs()))
    try {
      const content = []
      for (const image of Array.isArray(images) ? images : []) content.push({ type: 'image', attachment: image })
      if (typeof user === 'string' && user.length > 0) content.push({ type: 'text', text: user })
      const stream = llm.stream({
        provider: route.provider,
        model: route.model,
        system,
        messages: [{ role: 'user', content }],
        maxTokens,
        signal: controller.signal,
      })
      let text = ''
      let failure
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') text += chunk.text
        else if (chunk.type === 'finish' && (chunk.reason?.kind === 'error' || chunk.reason?.kind === 'aborted')) failure = chunk.reason.failure
      }
      if (failure !== undefined) {
        throw new Error(typeof failure?.message === 'string' && failure.message.length > 0 ? failure.message : '模型调用失败')
      }
      return text
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  /**
   * Structure one report from text and/or images.
   * @returns {Promise<{reportDate?: string, institution?: string, indicators: object[], summary?: string}>}
   */
  async extractReport({ text, images, signal }) {
    const route = await this.resolveModel()
    let imageRefs
    if (Array.isArray(images) && images.length > 0) {
      if (!route.imageSupported) throw new Error('当前默认模型不支持图片识别，请粘贴报告文字或手动录入指标')
      const attachments = this.getAttachments()
      if (attachments === undefined) throw new Error('图片存储服务不可用')
      imageRefs = []
      for (const image of images) {
        imageRefs.push(await attachments.saveImage({ data: image.data, mediaType: image.mediaType, name: image.name }))
      }
    }
    const prompt = typeof text === 'string' && text.trim().length > 0
      ? `请从下面的体检报告文本中提取结构化数据：\n\n${text.slice(0, 30000)}`
      : '请从图片中的体检报告提取结构化数据。'
    let lastError
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = await this.complete({
        system: EXTRACT_SYSTEM,
        user: attempt === 0 ? prompt : `${prompt}\n\n注意：上一次输出不是合法 JSON，请严格只输出 JSON 对象。`,
        images: imageRefs,
        maxTokens: 4000,
        signal,
      })
      const parsed = parseModelJson(raw)
      if (parsed !== undefined && Array.isArray(parsed.indicators)) {
        return {
          reportDate: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.reportDate ?? '')) ? String(parsed.reportDate) : undefined,
          institution: typeof parsed.institution === 'string' ? parsed.institution.slice(0, 120) : undefined,
          indicators: parsed.indicators.slice(0, 300),
          summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 3000) : undefined,
        }
      }
      lastError = new Error(parsed === undefined ? '模型返回的内容不是有效 JSON' : '模型未能把报告整理成结构化数据')
    }
    throw lastError ?? new Error('报告解析失败')
  }

  /**
   * Generate longevity-framework risks and advice for one record.
   * @returns {Promise<object>}
   */
  async generateAdvice({ person, record, records, signal }) {
    const payload = buildAdvicePayload(person, record, records)
    let lastError
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = await this.complete({
        system: ADVICE_SYSTEM,
        user: attempt === 0 ? payload : `${payload}\n\n上一次输出不是合法 JSON，请严格只输出 JSON 对象（不要代码块、不要解释）。`,
        maxTokens: 4000,
        signal,
      })
      const parsed = parseModelJson(raw)
      const normalized = parsed === undefined ? undefined : normalizeAdvice(parsed)
      if (normalized !== undefined) {
        const route = await this.resolveModel()
        return {
          id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          personId: person.id,
          recordId: record.id,
          recordDate: record.date,
          createdAt: localTimestamp(),
          askedAt: localDate(),
          model: `${route.provider}/${route.model}`,
          ...normalized,
        }
      }
      lastError = new Error('模型返回的建议不是有效 JSON')
    }
    throw lastError ?? new Error('建议生成失败')
  }
}
