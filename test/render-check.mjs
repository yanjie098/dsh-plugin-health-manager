/**
 * Render check for client.js without a browser: evaluates the module with a
 * stubbed React and calls every panel component once with representative data,
 * expanding nested function components. Catches reference errors and bad
 * element shapes that a syntax check cannot.
 */
import { readFileSync } from 'node:fs'

let stateQueue = []
const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useState: (initial) => {
    const value = stateQueue.length > 0 ? stateQueue.shift() : typeof initial === 'function' ? initial() : initial
    return [value, () => {}]
  },
  useEffect: () => {},
  useCallback: (fn) => fn,
  useRef: (value) => ({ current: value }),
  Fragment: 'Fragment',
}

const failures = []
/** Recursively invoke function components and walk the produced element tree. */
function walk(node, path) {
  if (node === null || node === undefined || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return
  if (Array.isArray(node)) {
    node.forEach((child, index) => walk(child, `${path}[${index}]`))
    return
  }
  if (typeof node !== 'object') return
  const { type, props, children } = node
  if (typeof type === 'function') {
    const name = type.name || 'component'
    try {
      const produced = type({ ...props, children: children.length > 0 ? children : props?.children })
      walk(produced, `${path}/${name}`)
    } catch (error) {
      failures.push(`${path}/${name}: ${error.message}`)
    }
    return
  }
  walk(children, path)
  if (props && props.children) walk(props.children, `${path}.props.children`)
}

let definition
globalThis.window = { __ModuleLoader__: { load: (value) => { definition = value } } }
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(
  "    return {\n      inject: ['slots'],",
  "    return {\n      __test: { HealthPanel, OverviewTab, HistoryTab, AdviceTab, PersonForm, DailyForm, ReportDialog, DraftDialog, AdviceCard, MemberList, PanelIcon, TrendChart, Modal },\n      inject: ['slots'],",
)
new Function(source)()
const exported = definition.factory((name) => {
  if (name === 'react') return fakeReact
  throw new Error(`unexpected require(${name})`)
})
const components = exported.__test
if (components === undefined) throw new Error('test hook missing from the client module')

const registrations = []
exported.apply({
  slots: {
    inject: (_slot, callback) => { callback(); return () => {} },
    register: (options, component) => { registrations.push({ options, component }); return () => {} },
  },
})
const panel = registrations.find((entry) => entry.options.key === 'health-manager')?.component
if (typeof panel !== 'function') throw new Error('panel component not registered')

const person = {
  id: 'p_0123456789', name: '测试成员', sex: 'male', birthDate: '1985-06-01', age: 41, heightCm: 175, relation: '本人', notes: '',
  recordCount: 2, checkupCount: 1, lastCheckup: '2026-11-01', lastDaily: '2026-11-09', abnormalLatest: 3,
}
const records = [
  {
    id: 'r_0000000001', kind: 'checkup', date: '2026-11-01', abnormalCount: 3, systems: ['metabolism', 'cardiovascular'], adviceId: 'a_0000000001',
    summary: '血糖偏高', notes: '体检机构：某中心', source: { type: 'image', reportPath: 'reports/2026-11-01_report.jpg' },
    indicators: [
      { key: 'fasting_glucose', name: '空腹血糖', value: 6.4, unit: 'mmol/L', refLow: 3.9, refHigh: 6.1, status: 'high', systems: ['metabolism'] },
      { key: 'sbp', name: '收缩压', value: 145, unit: 'mmHg', refLow: 90, refHigh: 139, status: 'high' },
      { key: 'bmi', name: 'BMI', value: 26.1, unit: 'kg/m²', refLow: 18.5, refHigh: 23.9, status: 'high' },
    ],
  },
  {
    id: 'r_0000000002', kind: 'daily', date: '2026-11-09', abnormalCount: 1, systems: ['metabolism'],
    indicators: [{ key: 'weight_kg', name: '体重', value: 79.2, unit: 'kg', status: 'normal' }, { key: 'sbp', name: '收缩压', value: 138, unit: 'mmHg', status: 'high' }],
  },
]
const advice = {
  id: 'a_0000000001', recordId: 'r_0000000001', recordDate: '2026-11-01', createdAt: '2026-11-01T10:00:00', model: 'deepseek-account/deepseek-flash',
  summary: '代谢与心血管需要关注', overallRiskLevel: 'medium',
  systems: [{ system: '代谢失衡系统', status: '关注', finding: '空腹血糖 6.4 mmol/L', advice: '减少精制碳水' }],
  risks: [{ level: 'medium', system: '代谢失衡系统', title: '空腹血糖受损', detail: '建议复查' }],
  diet: [{ title: '少糖', detail: '减少含糖饮料' }],
  fitness: [{ title: '有氧', detail: '每周 150 分钟' }],
  monitoring: [{ title: 'OGTT', detail: '评估糖代谢' }],
  trend: ['首次记录，暂无趋势'],
}
const detail = { person, records, advice }
const draft = {
  draftId: 'd1', personId: person.id, kind: 'checkup', date: '2026-11-01', institution: '某中心', summary: '血糖偏高',
  warnings: ['有一项未匹配'],
  indicators: [{ key: 'fasting_glucose', name: '空腹血糖', value: 6.4, unit: 'mmol/L', refLow: 3.9, refHigh: 6.1, status: 'high' }],
  source: { type: 'image', fileName: 'report.jpg', reportPath: 'reports/report.jpg' },
  rawText: '报告原文',
}
const noop = () => {}
const cases = [
  ['HealthPanel default', () => panel()],
  ['MemberList', () => components.MemberList({ people: [person], selectedId: person.id, onSelect: noop, onAdd: noop })],
  ['PanelIcon active', () => components.PanelIcon({ size: 18, active: true })],
  ['OverviewTab', () => { stateQueue = []; return components.OverviewTab({ detail, advice, onOpenTab: noop }) }],
  ['HistoryTab', () => { stateQueue = []; return components.HistoryTab({ detail, onRefresh: noop, onDeleteRecord: noop, onBusy: noop, onError: noop }) }],
  ['AdviceTab', () => { stateQueue = []; return components.AdviceTab({ advice, onRegenerate: noop, busy: false }) }],
  ['AdviceCard empty', () => components.AdviceCard({ advice: undefined })],
  ['TrendChart', () => components.TrendChart({ title: '体重', unit: ' kg', points: [{ date: '2026-10-01', value: 80 }, { date: '2026-11-01', value: 78 }] })],
  ['PersonForm create', () => { stateQueue = []; return components.PersonForm({ onClose: noop, onSubmit: noop }) }],
  ['PersonForm edit', () => { stateQueue = []; return components.PersonForm({ initial: person, onClose: noop, onSubmit: noop }) }],
  ['DailyForm', () => { stateQueue = []; return components.DailyForm({ today: '2026-11-09', onClose: noop, onSubmit: noop }) }],
  ['ReportDialog', () => { stateQueue = []; return components.ReportDialog({ personId: person.id, onClose: noop, onBusy: noop, onDraft: noop }) }],
  ['DraftDialog', () => { stateQueue = []; return components.DraftDialog({ draft, personId: person.id, today: '2026-11-09', onClose: noop, onSave: noop }) }],
]

for (const [name, run] of cases) {
  const before = failures.length
  try {
    walk(run(), name)
  } catch (error) {
    failures.push(`${name}: ${error.message}`)
  }
  if (failures.length === before) console.log(`  ok  ${name}`)
  else console.log(`FAIL  ${name}`)
}
if (failures.length > 0) {
  console.log('FAILURES:')
  for (const failure of failures) console.log(` - ${failure}`)
  process.exitCode = 1
} else {
  console.log('ALL CLIENT RENDERS OK')
}
