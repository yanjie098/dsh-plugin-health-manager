/**
 * Agent tools for the health manager. They call the same store and advisor as
 * the panel, so one operation has one implementation for both callers.
 *
 * Importing a report through chat is deliberately two steps: `health_import_report`
 * returns a draft for the user to confirm, and `health_confirm_report` persists
 * it and pushes that update's risks and advice.
 */
import { ageFrom, isDateText, localDate } from './store.js'
import { adviceToText } from './llm.js'
import { abnormalOf, buildIndicator, seriesOf } from './indicators.js'
import { SYSTEMS } from './longevity.js'

/** Build one registry-ready tool definition without depending on dsh-tools. */
function defineTool({ name, description, parameters, execute }) {
  return {
    name,
    description,
    parameters: { type: 'object', properties: parameters ?? {} },
    output: {
      schema: {},
      render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      return await execute(args ?? {})
    },
  }
}

/** Require one non-empty string argument. */
function requireText(args, field, label) {
  const value = typeof args?.[field] === 'string' ? args[field].trim() : ''
  if (value.length === 0) throw new Error(`缺少参数 ${label ?? field}`)
  return value
}

/** Compact record summary for tool output. */
function recordSummary(record) {
  return {
    id: record.id,
    kind: record.kind,
    date: record.date,
    abnormalCount: record.abnormalCount ?? abnormalOf(record.indicators).length,
    systems: (record.systems ?? []).map((key) => SYSTEMS.find((system) => system.key === key)?.name ?? key),
    abnormal: abnormalOf(record.indicators).map((indicator) => `${indicator.name} ${indicator.value}${indicator.unit}（${indicator.status === 'high' ? '偏高' : indicator.status === 'low' ? '偏低' : '异常'}）`),
    summary: record.summary,
    adviceId: record.adviceId,
  }
}

/** Compact advice summary for tool output. */
function adviceSummary(advice) {
  if (advice === undefined) return undefined
  return {
    id: advice.id,
    recordDate: advice.recordDate,
    overallRiskLevel: advice.overallRiskLevel,
    summary: advice.summary,
    systems: advice.systems,
    risks: advice.risks,
    diet: advice.diet,
    fitness: advice.fitness,
    monitoring: advice.monitoring,
    trend: advice.trend,
  }
}

/**
 * Register the health tools on the Host tool registry.
 * @param {object} _ctx cordis Context (owned by the caller's effect)
 * @param {object} tools the Host tool registry service
 * @param {import('./store.js').HealthStore} store
 * @param {import('./llm.js').HealthAdvisor} advisor
 */
export function registerHealthTools(_ctx, tools, store, advisor) {
  /** @type {object[]} */
  const definitions = []

  definitions.push(defineTool({
    name: 'health_list_people',
    description: '列出健康管理中的所有成员（姓名、性别、年龄、身高、记录数量与最近一次体检/日常记录日期）。',
    async execute() {
      return await store.listPeopleState((person, records, advice) => {
        const checkups = records.filter((record) => record.kind === 'checkup')
        return {
          id: person.id,
          name: person.name,
          sex: person.sex,
          age: ageFrom(person.birthDate),
          heightCm: person.heightCm,
          relation: person.relation,
          recordCount: records.length,
          lastCheckup: checkups.at(-1)?.date,
          lastDaily: records.filter((record) => record.kind === 'daily').at(-1)?.date,
          latestAdviceDate: advice?.recordDate,
        }
      })
    },
  }))

  definitions.push(defineTool({
    name: 'health_add_person',
    description: '新增一个健康管理成员（每个人有独立的健康数据文件夹和一个 health.json）。返回新成员的 id。',
    parameters: {
      name: { type: 'string', description: '成员姓名（同一时间不能重名）' },
      sex: { type: 'string', enum: ['male', 'female', 'unknown'], description: '性别，默认 unknown' },
      birthDate: { type: 'string', description: '出生日期 YYYY-MM-DD，可省略' },
      heightCm: { type: 'number', description: '身高厘米，可省略' },
      relation: { type: 'string', description: '与你的关系，例如 本人/父亲/母亲，可省略' },
      notes: { type: 'string', description: '备注，可省略' },
    },
    async execute(args) {
      const person = await store.createPerson(args)
      return { ok: true, person: { id: person.id, name: person.name } }
    },
  }))

  definitions.push(defineTool({
    name: 'health_get_person',
    description: '读取一名成员的档案、最近记录（含异常指标与涉及的长寿系统）以及最新一次健康风险与建议。',
    parameters: {
      personId: { type: 'string', description: '成员 id；不知道时先用 health_list_people' },
      recordLimit: { type: 'integer', description: '返回最近多少条记录，1–50，默认 10' },
    },
    async execute(args) {
      const personId = requireText(args, 'personId')
      const person = await store.getPerson(personId)
      if (person === undefined) throw new Error('成员不存在')
      const records = await store.listRecords(personId)
      const advice = await store.latestAdvice(personId)
      const limit = Number.isInteger(args.recordLimit) ? Math.min(50, Math.max(1, args.recordLimit)) : 10
      return {
        person: {
          id: person.id,
          name: person.name,
          sex: person.sex,
          age: ageFrom(person.birthDate),
          heightCm: person.heightCm,
          relation: person.relation,
          notes: person.notes,
        },
        records: records.slice(-limit).reverse().map(recordSummary),
        latestAdvice: adviceSummary(advice),
      }
    },
  }))

  definitions.push(defineTool({
    name: 'health_add_daily_record',
    description: '为一名成员记录日常健康数据（体重、血压、心率、血糖、睡眠、运动、饮水、步数等）。保存后会基于《长寿管理》框架推送一次该更新相关的健康风险与建议。',
    parameters: {
      personId: { type: 'string', description: '成员 id' },
      date: { type: 'string', description: '日期 YYYY-MM-DD，省略为今天' },
      items: {
        type: 'array',
        description: '要记录的指标列表，例如 [{"name":"体重","value":72.5,"unit":"kg"},{"name":"收缩压","value":132}]',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '指标名称（体重/收缩压/舒张压/心率/空腹血糖/睡眠时长/运动时长/饮水量/步数等）' },
            value: { type: 'number', description: '数值' },
            unit: { type: 'string', description: '单位，可省略' },
          },
          required: ['name', 'value'],
        },
      },
      notes: { type: 'string', description: '备注，可省略' },
    },
    async execute(args) {
      const personId = requireText(args, 'personId')
      const items = Array.isArray(args.items) ? args.items : []
      if (items.length === 0) throw new Error('items 至少包含一项日常数据')
      const { person, record } = await store.addRecord(personId, {
        kind: 'daily',
        date: isDateText(args.date) ? args.date : localDate(),
        indicators: items.map((item) => ({ name: item.name, value: item.value, unit: item.unit })),
        notes: args.notes,
        source: { type: 'manual', channel: 'chat' },
      })
      let advice
      let warning
      try {
        const records = await store.listRecords(personId)
        advice = await advisor.generateAdvice({ person, record, records })
        await store.saveAdvice(personId, advice)
      } catch (error) {
        warning = `本次建议推送失败：${error instanceof Error ? error.message : String(error)}`
      }
      return { ok: true, record: recordSummary(record), advice: adviceSummary(advice), warning }
    },
  }))

  definitions.push(defineTool({
    name: 'health_import_report',
    description: '把一次体检报告的文本交给多模态模型识别成结构化指标草稿（不写入历史）。返回 date、institution、indicators、summary；请把指标展示给用户确认，确认后再调用 health_confirm_report 保存。用户上传的图片/PDF 由你直接阅读后，也可以把整理好的指标直接传给 health_confirm_report。',
    parameters: {
      personId: { type: 'string', description: '成员 id' },
      text: { type: 'string', description: '体检报告原始文字（可包含多页）' },
      date: { type: 'string', description: '体检日期 YYYY-MM-DD，省略则由模型从报告识别' },
    },
    async execute(args, exec) {
      const personId = requireText(args, 'personId')
      const text = requireText(args, 'text', 'text（报告原文）')
      const person = await store.getPerson(personId)
      if (person === undefined) throw new Error('成员不存在')
      const extraction = await advisor.extractReport({ text, signal: exec?.signal })
      const sex = person.sex === 'female' ? 'female' : person.sex === 'male' ? 'male' : undefined
      const indicators = (extraction.indicators ?? []).map((row) => {
        const indicator = buildIndicator(row.name, row.value, row.unit, row.refLow, row.refHigh, sex)
        return { key: indicator.key, name: indicator.name, value: indicator.value, unit: indicator.unit, refLow: indicator.refLow, refHigh: indicator.refHigh }
      })
      return {
        draft: true,
        personId,
        date: isDateText(args.date) ? args.date : extraction.reportDate ?? localDate(),
        institution: extraction.institution,
        summary: extraction.summary,
        indicators,
        next: '请让用户确认/修改上述指标，然后调用 health_confirm_report 保存；保存后会自动推送本系统相关的风险与建议。',
      }
    },
  }))

  definitions.push(defineTool({
    name: 'health_confirm_report',
    description: '保存用户已确认的一次体检记录，并基于《长寿管理》框架生成并推送该次更新的健康风险、饮食、健身与监测建议。indicators 使用 health_import_report 返回（或用户修正后）的列表。',
    parameters: {
      personId: { type: 'string', description: '成员 id' },
      date: { type: 'string', description: '体检日期 YYYY-MM-DD' },
      indicators: {
        type: 'array',
        description: '确认后的指标列表',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: '内置指标 key，可省略' },
            name: { type: 'string', description: '指标名称' },
            value: { type: ['number', 'string'], description: '数值或文字结果' },
            unit: { type: 'string', description: '单位' },
            refLow: { type: 'number', description: '参考下限' },
            refHigh: { type: 'number', description: '参考上限' },
          },
          required: ['name', 'value'],
        },
      },
      summary: { type: 'string', description: '报告结论/本次小结，可省略' },
      notes: { type: 'string', description: '体检机构或备注，可省略' },
      rawText: { type: 'string', description: '报告原文，可省略' },
    },
    async execute(args) {
      const personId = requireText(args, 'personId')
      const { person, record } = await store.addRecord(personId, {
        kind: 'checkup',
        date: isDateText(args.date) ? args.date : localDate(),
        indicators: Array.isArray(args.indicators) ? args.indicators : [],
        summary: args.summary,
        notes: args.notes,
        rawText: args.rawText,
        source: { type: 'text', channel: 'chat' },
      })
      let advice
      let warning
      try {
        const records = await store.listRecords(personId)
        advice = await advisor.generateAdvice({ person, record, records })
        await store.saveAdvice(personId, advice)
      } catch (error) {
        warning = `本次建议推送失败：${error instanceof Error ? error.message : String(error)}`
      }
      return {
        ok: true,
        record: recordSummary(record),
        advice: adviceSummary(advice),
        warning,
        rendered: advice === undefined ? undefined : adviceToText(advice),
      }
    },
  }))

  definitions.push(defineTool({
    name: 'health_get_history',
    description: '读取一名成员的历史记录与趋势（体重、腰围、血压、血糖、血脂、炎症、握力等序列），用于回答趋势类问题。',
    parameters: {
      personId: { type: 'string', description: '成员 id' },
      limit: { type: 'integer', description: '返回最近多少条记录，1–100，默认 20' },
    },
    async execute(args) {
      const personId = requireText(args, 'personId')
      const person = await store.getPerson(personId)
      if (person === undefined) throw new Error('成员不存在')
      const records = await store.listRecords(personId)
      const limit = Number.isInteger(args.limit) ? Math.min(100, Math.max(1, args.limit)) : 20
      return {
        person: { id: person.id, name: person.name, age: ageFrom(person.birthDate), heightCm: person.heightCm },
        trends: {
          weight: seriesOf(records, 'weight_kg'),
          waist: seriesOf(records, 'waist_cm'),
          systolic: seriesOf(records, 'sbp'),
          diastolic: seriesOf(records, 'dbp'),
          fastingGlucose: seriesOf(records, 'fasting_glucose'),
          ldl: seriesOf(records, 'ldl_c'),
          hsCrp: seriesOf(records, 'hs_crp'),
          uricAcid: seriesOf(records, 'uric_acid'),
          grip: seriesOf(records, 'grip_kg'),
        },
        records: records.slice(-limit).reverse().map(recordSummary),
      }
    },
  }))

  definitions.push(defineTool({
    name: 'health_get_advice',
    description: '读取一名成员最近一次（或指定记录）的健康风险与建议：框架系统评估、风险提示、饮食、健身、监测与趋势解读。',
    parameters: {
      personId: { type: 'string', description: '成员 id' },
      recordId: { type: 'string', description: '记录 id，可省略（默认最新）' },
    },
    async execute(args) {
      const personId = requireText(args, 'personId')
      let advice
      if (typeof args.recordId === 'string' && args.recordId.length > 0) {
        const records = await store.listRecords(personId)
        const record = records.find((entry) => entry.id === args.recordId)
        if (record === undefined) throw new Error('记录不存在')
        if (record.adviceId !== undefined) advice = await store.getAdvice(personId, record.adviceId)
      } else {
        advice = await store.latestAdvice(personId)
      }
      if (advice === undefined) return '该成员还没有生成过建议。可以先保存一次体检记录，再调用 health_generate_advice。'
      return adviceToText(advice)
    },
  }))

  definitions.push(defineTool({
    name: 'health_generate_advice',
    description: '为一名成员的某次记录（默认最新一条体检记录）重新生成并推送基于《长寿管理》框架的健康风险与建议。生成需要数十秒。',
    parameters: {
      personId: { type: 'string', description: '成员 id' },
      recordId: { type: 'string', description: '记录 id，可省略（默认最新体检记录，没有则最新记录）' },
    },
    async execute(args) {
      const personId = requireText(args, 'personId')
      const person = await store.getPerson(personId)
      if (person === undefined) throw new Error('成员不存在')
      const records = await store.listRecords(personId)
      if (records.length === 0) throw new Error('该成员还没有任何健康记录')
      let record
      if (typeof args.recordId === 'string' && args.recordId.length > 0) {
        record = records.find((entry) => entry.id === args.recordId)
        if (record === undefined) throw new Error('记录不存在')
      } else {
        record = records.filter((entry) => entry.kind === 'checkup').at(-1) ?? records.at(-1)
      }
      const advice = await advisor.generateAdvice({ person, record, records })
      await store.saveAdvice(personId, advice)
      return adviceToText(advice)
    },
  }))

  const disposers = []
  for (const definition of definitions) disposers.push(tools.register(definition))
  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}
