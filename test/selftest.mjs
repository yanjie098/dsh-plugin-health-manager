/** Local self-test for the health-manager Host modules (`node test/selftest.mjs`). */
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HealthStore } from '../host/store.js'
import { buildIndicator, deriveIndicators, abnormalOf } from '../host/indicators.js'
import { parseModelJson, normalizeAdvice, buildAdvicePayload } from '../host/llm.js'
import { frameworkText, SYSTEMS } from '../host/longevity.js'

const failures = []
const check = (name, ok) => {
  if (ok) console.log(`  ok  ${name}`)
  else { failures.push(name); console.log(`FAIL  ${name}`) }
}

function testIndicators() {
  console.log('indicators')
  check('numeric indicator', buildIndicator('空腹血糖', '6.4', 'mmol/L', 3.9, 6.1, 'male').status === 'high')
  check('alias + default range', buildIndicator('谷丙转氨酶(ALT)', '55', 'U/L', null, null, 'male').refHigh === 40)
  check('text indicator', buildIndicator('尿蛋白', '阴性', '', null, null, 'female').status === 'normal')
  check('custom indicator', buildIndicator('某新型指标', '12.3', 'x', 1, 10, 'male').key === 'custom:某新型指标')
  const list = [
    buildIndicator('身高', '175', 'cm', null, null, 'male'),
    buildIndicator('体重', '80', 'kg', null, null, 'male'),
    buildIndicator('空腹血糖', '6.4', 'mmol/L', null, null, 'male'),
    buildIndicator('空腹胰岛素', '18', 'μIU/mL', null, null, 'male'),
    buildIndicator('收缩压', '145', 'mmHg', null, null, 'male'),
    buildIndicator('舒张压', '95', 'mmHg', null, null, 'male'),
    buildIndicator('中性粒细胞', '5.0', '×10⁹/L', null, null, 'male'),
    buildIndicator('淋巴细胞', '2.0', '×10⁹/L', null, null, 'male'),
  ]
  deriveIndicators(list, { sex: 'male' })
  const byKey = new Map(list.map((entry) => [entry.key, entry]))
  check('bmi derived', byKey.get('bmi')?.value === 26.1)
  check('homa-ir derived', Math.abs((byKey.get('homa_ir')?.value ?? 0) - 5.12) < 0.01)
  check('pulse pressure derived', byKey.get('pulse_pressure')?.value === 50)
  check('nlr derived', byKey.get('nlr')?.value === 2.5)
  check('abnormal list', abnormalOf(list).length >= 4)
}

function testFramework() {
  console.log('longevity framework')
  check('twelve systems', SYSTEMS.length === 12)
  check('framework text', frameworkText().includes('代谢失衡系统') && frameworkText().includes('三级监测体系'))
}

async function testStore() {
  console.log('store')
  const root = await mkdtemp(join(tmpdir(), 'dsh-health-test-'))
  try {
    const store = new HealthStore(root)
    await store.init()
    const person = await store.createPerson({ name: '测试成员', sex: 'male', birthDate: '1985-06-01', heightCm: 175 })
    const folder = join(root, person.id)
    const files = await readdir(folder)
    check('one health.json + reports', files.includes('health.json') && files.includes('reports') && files.length === 2)
    const { record } = await store.addRecord(person.id, {
      kind: 'checkup', date: '2026-11-09',
      indicators: [{ name: '体重', value: 80, unit: 'kg' }, { name: '收缩压', value: 145, unit: 'mmHg' }, { name: '空腹血糖', value: 6.4, unit: 'mmol/L' }],
      summary: '血压偏高', source: { type: 'text' },
    })
    check('record with derived metrics', record.indicators.some((entry) => entry.key === 'bmi'))
    check('record flags', record.abnormalCount >= 2 && record.systems.includes('metabolism'))
    await store.addRecord(person.id, { kind: 'daily', date: '2026-11-10', indicators: [{ name: '体重', value: 79.2, unit: 'kg' }] })
    check('two records in one json', (await store.readHealth(person.id)).records.length === 2)
    const advice = await store.saveAdvice(person.id, {
      id: 'a_000000001', recordId: record.id, recordDate: '2026-11-09', createdAt: '2026-11-09T12:00:00',
      summary: '代谢与心血管需要关注', overallRiskLevel: 'medium',
      systems: [{ system: '代谢失衡系统', status: '关注', finding: '空腹血糖 6.4', advice: '减少精制碳水' }],
      risks: [{ level: 'medium', system: '代谢失衡系统', title: '空腹血糖受损', detail: '建议复查' }],
      diet: [{ title: '少糖', detail: '减少含糖饮料' }], fitness: [], monitoring: [], trend: [],
    })
    check('advice attached', (await store.readHealth(person.id)).records.find((entry) => entry.id === record.id)?.adviceId === advice.id)
    check('latest advice', (await store.latestAdvice(person.id))?.summary.includes('代谢'))
    const report = await store.saveReportFile(person.id, '体检报告 2026.pdf', Buffer.from('pdf-bytes'), '2026-11-09')
    check('report archived + read', (await store.readReportFile(person.id, report.reportPath)).data.toString() === 'pdf-bytes')
    let blocked = false
    try { await store.readReportFile(person.id, '../health.json') } catch { blocked = true }
    check('path traversal blocked', blocked)
    await store.deleteRecord(person.id, record.id)
    check('record + advice deleted', (await store.readHealth(person.id)).records.length === 1)
    await store.deletePerson(person.id)
    check('person deleted', (await store.listPeopleState((entry) => ({ id: entry.id }))).length === 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

function testAdviceHelpers() {
  console.log('advice helpers')
  check('parse json', parseModelJson('{"summary":"a"}')?.summary === 'a')
  check('parse fenced json', parseModelJson('```json\n{"summary":"b"}\n```')?.summary === 'b')
  const normalized = normalizeAdvice({
    summary: 's', overallRiskLevel: 'high',
    systems: [{ system: '代谢失衡系统', status: '关注', finding: 'f', advice: 'a' }],
    risks: [{ level: 'high', title: 'r', detail: 'x' }],
    diet: [{ title: 't', detail: 'd' }], fitness: [{ title: 'f', detail: 'd' }],
    monitoring: [{ title: 'm', detail: 'd' }], trend: ['t1'],
  })
  check('normalize advice', normalized.systems.length === 1 && normalized.monitoring.length === 1)
  const payload = buildAdvicePayload(
    { id: 'p_1', name: '张三', sex: 'male', birthDate: '1985-06-01', heightCm: 175 },
    { id: 'r_1', date: '2026-11-09', kind: 'checkup', indicators: [{ key: 'fasting_glucose', name: '空腹血糖', value: 6.4, unit: 'mmol/L', status: 'high', refLow: 3.9, refHigh: 6.1, systems: ['metabolism'] }] },
    [{ id: 'r_0', date: '2026-04-01', kind: 'checkup', indicators: [{ key: 'weight_kg', name: '体重', value: 78, unit: 'kg', status: 'normal' }] }],
  )
  check('payload de-identified', !payload.includes('张三') && payload.includes('年龄') && payload.includes('空腹血糖'))
  check('payload names framework system', payload.includes('代谢失衡系统'))
}

try {
  testIndicators()
  testFramework()
  await testStore()
  testAdviceHelpers()
} catch (error) {
  failures.push('unexpected error')
  console.error(error)
}
console.log(failures.length === 0 ? 'ALL PASS' : `FAILURES: ${failures.join(', ')}`)
process.exitCode = failures.length === 0 ? 0 : 1
