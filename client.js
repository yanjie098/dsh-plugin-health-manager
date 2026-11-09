/**
 * Client half of the health-manager bundle: one sidebar entry and one main
 * panel. Plain browser ESM (no build step) that registers through the slot
 * service and talks to the Host route at /health-manager/api.
 *
 * Layout: member list on the left; the selected member's overview, history and
 * latest pushed advice on the right. Report imports are two steps: the model
 * recognizes the report, the panel shows an editable draft, and only an explicit
 * save writes the health JSON and pushes that update's advice.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-health-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const PANEL_ID = 'health-manager'
    const API = '/health-manager/api'

    // ---------------------------------------------------------------- styles
    const C = {
      bg: 'var(--dsw-alias-bg-base)',
      layer: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2)',
      overlay: 'var(--dsw-alias-bg-overlay)',
      border: 'var(--dsw-alias-border-l1)',
      border2: 'var(--dsw-alias-border-l2)',
      text: 'var(--dsw-alias-label-primary)',
      sub: 'var(--dsw-alias-label-secondary)',
      brand: 'var(--dsw-alias-brand-primary)',
      ok: 'var(--dsw-alias-state-success-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      err: 'var(--dsw-alias-state-error-primary)',
      idle: 'var(--dsw-alias-state-idle-primary)',
      sidebar: 'var(--dsw-specific-sidebar-fill)',
    }

    const S = {
      page: { display: 'flex', width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden', color: C.text, background: C.bg, fontSize: 13, lineHeight: 1.55 },
      aside: { display: 'flex', flexDirection: 'column', width: 240, flexShrink: 0, borderRight: `1px solid ${C.border}`, background: C.sidebar, minHeight: 0 },
      asideHead: { padding: '18px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
      asideTitle: { fontSize: 15, fontWeight: 600 },
      asideList: { flex: 1, minHeight: 0, overflow: 'auto', padding: '0 8px 12px' },
      member: (active) => ({
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid transparent',
        borderRadius: 8, padding: '8px 10px', marginBottom: 2, background: active ? C.layer2 : 'transparent', color: C.text,
        font: 'inherit', outline: 'none',
      }),
      memberName: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 },
      memberMeta: { color: C.sub, fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      main: { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' },
      header: { padding: '16px 24px 10px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
      h1: { fontSize: 18, fontWeight: 600, margin: 0 },
      metaRow: { display: 'flex', gap: 12, color: C.sub, fontSize: 12, flexWrap: 'wrap' },
      toolbar: { display: 'flex', gap: 8, flexWrap: 'wrap' },
      scroll: { flex: 1, minHeight: 0, overflow: 'auto' },
      content: { maxWidth: 960, margin: '0 auto', padding: '18px 24px 48px' },
      tabs: { display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, padding: '0 24px' },
      tab: (active) => ({ padding: '9px 14px', cursor: 'pointer', border: 'none', background: 'transparent', color: active ? C.text : C.sub, font: 'inherit', fontWeight: active ? 600 : 400, borderBottom: active ? `2px solid ${C.brand}` : '2px solid transparent', marginBottom: -1 }),
      card: { border: `1px solid ${C.border}`, borderRadius: 10, background: C.layer, padding: 16, marginBottom: 14 },
      cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
      cardTitle: { fontSize: 14, fontWeight: 600 },
      muted: { color: C.sub, fontSize: 12 },
      btn: (kind) => ({
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, cursor: 'pointer', font: 'inherit', fontSize: 12,
        border: `1px solid ${kind === 'primary' ? 'transparent' : C.border2}`,
        background: kind === 'primary' ? C.brand : kind === 'danger' ? 'transparent' : 'transparent',
        color: kind === 'primary' ? '#fff' : kind === 'danger' ? C.err : C.text,
        opacity: 1,
      }),
      btnSmall: { padding: '2px 8px', fontSize: 11, borderRadius: 6 },
      input: { width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: 7, border: `1px solid ${C.border2}`, background: C.layer2, color: C.text, font: 'inherit', fontSize: 12, outline: 'none' },
      label: { display: 'block', fontSize: 11, color: C.sub, margin: '8px 0 3px' },
      row: { display: 'flex', gap: 8, alignItems: 'center' },
      grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' },
      grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0 12px' },
      stats: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 14 },
      stat: { border: `1px solid ${C.border}`, borderRadius: 9, background: C.layer, padding: '10px 12px' },
      statLabel: { color: C.sub, fontSize: 11 },
      statValue: { fontSize: 15, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
      th: { textAlign: 'left', color: C.sub, fontWeight: 500, padding: '6px 8px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
      td: { padding: '6px 8px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' },
      chip: (tone) => ({
        display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 999, fontSize: 11, lineHeight: 1.6,
        background: tone === 'err' ? 'color-mix(in srgb, ' + C.err + ' 14%, transparent)' : tone === 'warn' ? 'color-mix(in srgb, ' + C.warn + ' 16%, transparent)' : tone === 'ok' ? 'color-mix(in srgb, ' + C.ok + ' 14%, transparent)' : C.layer2,
        color: tone === 'err' ? C.err : tone === 'warn' ? C.warn : tone === 'ok' ? C.ok : C.sub,
        border: `1px solid ${tone === 'err' ? 'transparent' : 'transparent'}`,
      }),
      overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 },
      dialog: { width: 'min(760px, 100%)', maxHeight: '86vh', overflow: 'auto', background: C.layer, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.28)' },
      dialogHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
      dialogTitle: { fontSize: 15, fontWeight: 600 },
      close: { border: 'none', background: 'transparent', color: C.sub, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 },
      notice: (kind) => ({ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1200, padding: '8px 16px', borderRadius: 8, fontSize: 12, color: '#fff', background: kind === 'err' ? C.err : C.ok, boxShadow: '0 6px 20px rgba(0,0,0,0.25)', maxWidth: '70vw' }),
      busy: { position: 'fixed', bottom: 22, right: 24, zIndex: 1200, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: C.overlay, border: `1px solid ${C.border2}`, color: C.text, fontSize: 12, boxShadow: '0 8px 26px rgba(0,0,0,0.25)' },
      adviceSectionTitle: { fontSize: 12, fontWeight: 600, color: C.sub, margin: '12px 0 6px' },
      listItem: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderBottom: `1px solid ${C.border}` },
      dot: (color) => ({ width: 6, height: 6, borderRadius: 6, background: color, marginTop: 6, flexShrink: 0 }),
      empty: { padding: '48px 24px', textAlign: 'center', color: C.sub },
      link: { color: C.brand, cursor: 'pointer', textDecoration: 'none', fontSize: 12 },
      warnBox: { border: `1px solid ${C.warn}`, background: 'color-mix(in srgb, ' + C.warn + ' 8%, transparent)', borderRadius: 8, padding: '8px 10px', fontSize: 12, marginBottom: 10, color: C.text },
    }

    // ------------------------------------------------------------------ api
    async function api(action, payload) {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      let body
      try {
        body = await response.json()
      } catch {
        throw new Error(`请求失败（HTTP ${response.status}）`)
      }
      if (!body || body.ok !== true) throw new Error((body && body.error && body.error.message) || `请求失败（HTTP ${response.status}）`)
      return body.data
    }

    async function uploadPdf(personId, file, date) {
      const response = await fetch(`${API}/upload`, {
        method: 'POST',
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'x-hm-person': personId,
          'x-hm-filename': encodeURIComponent(file.name),
          ...(date ? { 'x-hm-date': date } : {}),
        },
        body: file,
      })
      const body = await response.json()
      if (!body || body.ok !== true) throw new Error((body && body.error && body.error.message) || '上传识别失败')
      return body.data
    }

    function readFileText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.readAsText(file, 'utf-8')
      })
    }

    /** Downscale a photo to a bounded JPEG so the model request stays small. */
    async function imageForModel(file) {
      const bitmap = await createImageBitmap(file)
      const maxEdge = 1600
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(bitmap, 0, 0, width, height)
      bitmap.close?.()
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      return { name: file.name || 'report.jpg', mediaType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) }
    }

    // -------------------------------------------------------------- helpers
    function sexText(sex) {
      return sex === 'male' ? '男' : sex === 'female' ? '女' : '未设置'
    }
    function ageText(person) {
      return person && person.age !== undefined && person.age !== null ? `${person.age} 岁` : ''
    }
    function kindText(kind) {
      return kind === 'daily' ? '日常' : '体检'
    }
    function levelText(level) {
      return level === 'high' ? '高' : level === 'medium' ? '中' : '低'
    }
    function levelTone(level) {
      return level === 'high' ? 'err' : level === 'medium' ? 'warn' : 'ok'
    }
    function statusText(status) {
      return status === 'high' ? '偏高' : status === 'low' ? '偏低' : status === 'abnormal' ? '异常' : status === 'normal' ? '正常' : '—'
    }
    function statusTone(status) {
      return status === 'high' || status === 'low' ? 'err' : status === 'abnormal' ? 'warn' : 'ok'
    }
    function fmtRange(indicator) {
      if (indicator.refLow !== undefined && indicator.refHigh !== undefined) return `${indicator.refLow}–${indicator.refHigh}`
      if (indicator.refHigh !== undefined) return `≤${indicator.refHigh}`
      if (indicator.refLow !== undefined) return `≥${indicator.refLow}`
      return ''
    }
    function seriesOf(records, key) {
      const points = []
      for (const record of records || []) {
        const indicator = (record.indicators || []).find((item) => item.key === key)
        if (indicator && typeof indicator.value === 'number') points.push({ date: record.date, value: indicator.value })
      }
      points.sort((left, right) => String(left.date).localeCompare(String(right.date)))
      return points
    }
    function abnormalOf(record) {
      return (record && record.indicators ? record.indicators : []).filter((item) => item.status === 'high' || item.status === 'low' || item.status === 'abnormal')
    }
    function sourceLink(personId, record) {
      const source = record && record.source
      if (!source) return null
      const paths = Array.isArray(source.reportPaths) && source.reportPaths.length > 0 ? source.reportPaths : source.reportPath ? [source.reportPath] : []
      if (paths.length === 0) return null
      const path = paths[0]
      return `${API}/file/${encodeURIComponent(personId)}/${String(path).split('/').map(encodeURIComponent).join('/')}`
    }

    // ------------------------------------------------------------ components
    function Button(props) {
      const style = Object.assign({}, S.btn(props.kind), props.small ? S.btnSmall : {}, props.disabled ? { opacity: 0.55, cursor: 'default' } : {}, props.style || {})
      return h('button', { type: 'button', style, onClick: props.disabled ? undefined : props.onClick, title: props.title }, props.children)
    }

    function Chip(props) {
      return h('span', { style: S.chip(props.tone) }, props.children)
    }

    function Modal(props) {
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') props.onClose?.()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [])
      return h('div', { style: S.overlay, onMouseDown: (event) => { if (event.target === event.currentTarget) props.onClose?.() } },
        h('div', { style: Object.assign({}, S.dialog, props.width ? { width: props.width } : {}) },
          h('div', { style: S.dialogHead },
            h('div', { style: S.dialogTitle }, props.title),
            h('button', { type: 'button', style: S.close, onClick: props.onClose, title: '关闭' }, '×')),
          props.children))
    }

    function Field(props) {
      return h('label', null,
        h('span', { style: S.label }, props.label),
        props.children)
    }

    function TextInput(props) {
      return h('input', {
        style: Object.assign({}, S.input, props.style || {}),
        type: props.type || 'text',
        value: props.value === undefined || props.value === null ? '' : props.value,
        placeholder: props.placeholder,
        min: props.min,
        step: props.step,
        onChange: (event) => props.onChange(event.target.value),
      })
    }

    function TrendChart(props) {
      const points = props.points || []
      const width = 240
      const height = 64
      const pad = 6
      if (points.length < 2) {
        return h('div', { style: { color: C.sub, fontSize: 11, padding: '18px 0' } }, points.length === 1 ? `仅一次记录：${points[0].value}${props.unit || ''}` : '暂无数据')
      }
      const values = points.map((point) => point.value)
      const min = Math.min(...values)
      const max = Math.max(...values)
      const span = max - min || 1
      const stepX = (width - pad * 2) / (points.length - 1)
      const coords = points.map((point, index) => {
        const x = pad + index * stepX
        const y = height - pad - ((point.value - min) / span) * (height - pad * 2)
        return [x, y]
      })
      const polyline = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
      const last = points[points.length - 1]
      return h('div', null,
        h('div', { style: { display: 'flex', justifyContent: 'space-between', color: C.sub, fontSize: 11 } },
          h('span', null, props.title),
          h('span', null, `${last.value}${props.unit || ''}（${last.date}）`)),
        h('svg', { viewBox: `0 0 ${width} ${height}`, style: { width: '100%', height: 64, display: 'block', marginTop: 4 } },
          h('polyline', { points: polyline, fill: 'none', stroke: C.brand, strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' }),
          coords.map(([x, y], index) => h('circle', { key: String(index), cx: x, cy: y, r: index === coords.length - 1 ? 2.6 : 1.6, fill: index === coords.length - 1 ? C.brand : C.idle }))))
    }

    function AdviceCard(props) {
      const advice = props.advice
      if (!advice) return h('div', { style: S.empty }, props.emptyText || '暂无健康建议')
      return h('div', null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 } },
          h(Chip, { tone: levelTone(advice.overallRiskLevel) }, `总体风险 ${levelText(advice.overallRiskLevel)}`),
          advice.recordDate ? h('span', { style: S.muted }, `基于 ${advice.recordDate} 的记录`) : null,
          advice.model ? h('span', { style: S.muted }, advice.model) : null,
          props.onRegenerate ? h(Button, { small: true, style: { marginLeft: 'auto' }, onClick: props.onRegenerate, disabled: props.busy }, props.busy ? '生成中…' : '重新生成') : null),
        advice.summary ? h('div', { style: { fontSize: 13, margin: '6px 0 2px' } }, advice.summary) : null,
        (advice.systems || []).length > 0 ? h('div', null,
          h('div', { style: S.adviceSectionTitle }, '长寿系统评估'),
          h('div', null, advice.systems.map((system, index) => h('div', { key: String(index), style: S.listItem },
            h('span', { style: S.dot(system.status === '关注' ? C.warn : system.status === '正常' ? C.ok : C.idle) }),
            h('div', null,
              h('div', null, h('strong', null, system.system), ' ', h(Chip, { tone: system.status === '关注' ? 'warn' : system.status === '正常' ? 'ok' : 'idle' }, system.status)),
              system.finding ? h('div', { style: { color: C.sub, fontSize: 12 } }, system.finding) : null,
              system.advice ? h('div', { style: { fontSize: 12 } }, `建议：${system.advice}`) : null))))) : null,
        (advice.risks || []).length > 0 ? h('div', null,
          h('div', { style: S.adviceSectionTitle }, '健康风险提示'),
          h('div', null, advice.risks.map((risk, index) => h('div', { key: String(index), style: S.listItem },
            h('span', { style: S.dot(risk.level === 'high' ? C.err : risk.level === 'medium' ? C.warn : C.ok) }),
            h('div', null,
              h('div', null, h('strong', null, risk.title), ' ', h(Chip, { tone: levelTone(risk.level) }, levelText(risk.level)), risk.system ? h('span', { style: S.muted }, ` · ${risk.system}`) : null),
              h('div', { style: { color: C.sub, fontSize: 12 } }, risk.detail)))))) : null,
        (advice.diet || []).length > 0 ? h('div', null,
          h('div', { style: S.adviceSectionTitle }, '饮食建议'),
          advice.diet.map((item, index) => h('div', { key: String(index), style: { fontSize: 12, marginBottom: 4 } }, h('strong', null, item.title), '：', item.detail))) : null,
        (advice.fitness || []).length > 0 ? h('div', null,
          h('div', { style: S.adviceSectionTitle }, '健身建议'),
          advice.fitness.map((item, index) => h('div', { key: String(index), style: { fontSize: 12, marginBottom: 4 } }, h('strong', null, item.title), '：', item.detail))) : null,
        (advice.monitoring || []).length > 0 ? h('div', null,
          h('div', { style: S.adviceSectionTitle }, '建议补充的监测'),
          advice.monitoring.map((item, index) => h('div', { key: String(index), style: { fontSize: 12, marginBottom: 4 } }, h('strong', null, item.title), '：', item.detail))) : null,
        (advice.trend || []).length > 0 ? h('div', null,
          h('div', { style: S.adviceSectionTitle }, '趋势解读'),
          advice.trend.map((item, index) => h('div', { key: String(index), style: { fontSize: 12, marginBottom: 3 } }, `· ${item}`))) : null,
        h('div', { style: { marginTop: 10, color: C.idle, fontSize: 11 } }, '以上建议基于长寿管理框架自动生成，仅供健康管理参考，不能替代医生诊断。'))
    }

    function PersonForm(props) {
      const initial = props.initial || {}
      const [form, setForm] = useState({
        name: initial.name || '',
        sex: initial.sex || 'unknown',
        birthDate: initial.birthDate || '',
        heightCm: initial.heightCm === undefined ? '' : String(initial.heightCm),
        relation: initial.relation || '',
        notes: initial.notes || '',
      })
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)
      const update = (key, value) => setForm((current) => Object.assign({}, current, { [key]: value }))
      const submit = async () => {
        if (form.name.trim().length === 0) {
          setError('请填写姓名')
          return
        }
        setBusy(true)
        setError('')
        try {
          await props.onSubmit({
            ...(initial.id ? { id: initial.id } : {}),
            name: form.name.trim(),
            sex: form.sex,
            birthDate: form.birthDate,
            heightCm: form.heightCm === '' ? undefined : Number(form.heightCm),
            relation: form.relation.trim(),
            notes: form.notes.trim(),
          })
        } catch (failure) {
          setError(failure.message || String(failure))
        } finally {
          setBusy(false)
        }
      }
      return h(Modal, { title: initial.id ? '编辑成员' : '添加成员', onClose: props.onClose },
        h('div', { style: S.grid2 },
          h(Field, { label: '姓名 *' }, h(TextInput, { value: form.name, onChange: (value) => update('name', value), placeholder: '例如：张伟' })),
          h(Field, { label: '性别' }, h('select', { style: S.input, value: form.sex, onChange: (event) => update('sex', event.target.value) },
            h('option', { value: 'unknown' }, '未设置'), h('option', { value: 'male' }, '男'), h('option', { value: 'female' }, '女'))),
          h(Field, { label: '出生日期' }, h(TextInput, { type: 'date', value: form.birthDate, onChange: (value) => update('birthDate', value) })),
          h(Field, { label: '身高（cm）' }, h(TextInput, { type: 'number', value: form.heightCm, onChange: (value) => update('heightCm', value), placeholder: '例如 175' })),
          h(Field, { label: '关系' }, h(TextInput, { value: form.relation, onChange: (value) => update('relation', value), placeholder: '本人 / 父亲 / 母亲' }))),
        h(Field, { label: '备注' }, h('textarea', { style: Object.assign({}, S.input, { minHeight: 60, resize: 'vertical' }), value: form.notes, onChange: (event) => update('notes', event.target.value) })),
        error ? h('div', { style: { color: C.err, fontSize: 12, marginTop: 8 } }, error) : null,
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 } },
          h(Button, { onClick: props.onClose, disabled: busy }, '取消'),
          h(Button, { kind: 'primary', onClick: submit, disabled: busy }, busy ? '保存中…' : '保存')))
    }

    const DAILY_FIELDS = [
      { name: '体重', unit: 'kg' },
      { name: '腰围', unit: 'cm' },
      { name: '收缩压', unit: 'mmHg' },
      { name: '舒张压', unit: 'mmHg' },
      { name: '心率', unit: '次/分' },
      { name: '空腹血糖', unit: 'mmol/L' },
      { name: '睡眠时长', unit: '小时' },
      { name: '运动时长', unit: '分钟' },
      { name: '饮水量', unit: 'ml' },
      { name: '步数', unit: '步' },
    ]

    function DailyForm(props) {
      const today = props.today || ''
      const [date, setDate] = useState(today)
      const [values, setValues] = useState({})
      const [custom, setCustom] = useState([])
      const [notes, setNotes] = useState('')
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)
      const submit = async () => {
        const items = []
        for (const field of DAILY_FIELDS) {
          const raw = values[field.name]
          if (raw === undefined || String(raw).trim() === '') continue
          const number = Number(raw)
          if (!Number.isFinite(number)) continue
          items.push({ name: field.name, value: number, unit: field.unit })
        }
        for (const row of custom) {
          if (!row.name || String(row.value).trim() === '') continue
          const number = Number(row.value)
          items.push({ name: row.name, value: Number.isFinite(number) ? number : row.value, unit: row.unit || '' })
        }
        if (items.length === 0) {
          setError('至少填写一项日常数据')
          return
        }
        setBusy(true)
        setError('')
        try {
          await props.onSubmit({ date, indicators: items, notes })
        } catch (failure) {
          setError(failure.message || String(failure))
        } finally {
          setBusy(false)
        }
      }
      return h(Modal, { title: '记录日常健康数据', onClose: props.onClose, width: 720 },
        h('div', { style: S.metaRow },
          h(Field, { label: '日期' }, h(TextInput, { type: 'date', value: date, onChange: setDate })),
          h('div', { style: { color: C.sub, fontSize: 12, alignSelf: 'flex-end', paddingBottom: 6 } }, '保存后会基于你最新的健康 JSON 推送一次健康风险与建议。')),
        h('div', { style: S.grid3 },
          DAILY_FIELDS.map((field) => h(Field, { key: field.name, label: `${field.name}（${field.unit}）` },
            h(TextInput, { type: 'number', value: values[field.name], onChange: (value) => setValues((current) => Object.assign({}, current, { [field.name]: value })), placeholder: '不填则忽略' })))),
        h('div', { style: { marginTop: 10 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 } },
            h('span', { style: { fontSize: 12, fontWeight: 600 } }, '自定义指标'),
            h(Button, { small: true, onClick: () => setCustom((current) => current.concat([{ name: '', value: '', unit: '' }])) }, '添加一项')),
          custom.map((row, index) => h('div', { key: String(index), style: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 6 } },
            h(TextInput, { value: row.name, placeholder: '指标名称', onChange: (value) => setCustom((current) => current.map((entry, position) => position === index ? Object.assign({}, entry, { name: value }) : entry)) }),
            h(TextInput, { value: row.value, placeholder: '数值', onChange: (value) => setCustom((current) => current.map((entry, position) => position === index ? Object.assign({}, entry, { value }) : entry)) }),
            h(TextInput, { value: row.unit, placeholder: '单位', onChange: (value) => setCustom((current) => current.map((entry, position) => position === index ? Object.assign({}, entry, { unit: value }) : entry)) }),
            h(Button, { small: true, kind: 'danger', onClick: () => setCustom((current) => current.filter((_entry, position) => position !== index)) }, '删除'))),
          custom.length === 0 ? null : null),
        h(Field, { label: '备注' }, h(TextInput, { value: notes, onChange: setNotes, placeholder: '例如：今天睡眠不足、运动后血压测量' })),
        error ? h('div', { style: { color: C.err, fontSize: 12, marginTop: 8 } }, error) : null,
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 } },
          h(Button, { onClick: props.onClose, disabled: busy }, '取消'),
          h(Button, { kind: 'primary', onClick: submit, disabled: busy }, busy ? '保存并生成建议…' : '保存并生成建议')))
    }

    function ReportDialog(props) {
      const [files, setFiles] = useState([])
      const [text, setText] = useState('')
      const [date, setDate] = useState('')
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)
      const [dragOver, setDragOver] = useState(false)
      const fileInputRef = useRef(null)
      const onFiles = (list) => setFiles(Array.from(list || []).slice(0, 6))
      const analyze = async () => {
        setBusy(true)
        setError('')
        try {
          const trimmed = text.trim()
          if (files.length === 0 && trimmed.length < 40) {
            throw new Error('请选择报告文件，或粘贴至少一段报告文字')
          }
          let draft
          if (files.length === 0) {
            props.onBusy('正在让模型识别报告文字…')
            draft = (await api('report.analyzeText', { personId: props.personId, text: trimmed, ...(date ? { date } : {}) })).draft
          } else if (files.length === 1 && files[0].type === 'application/pdf') {
            props.onBusy('正在把 PDF 渲染成页面并识别（可能需要一点时间）…')
            draft = (await uploadPdf(props.personId, files[0], date)).draft
          } else if (files.every((file) => file.type.startsWith('image/'))) {
            props.onBusy('正在让多模态模型识别报告图片…')
            const images = []
            for (const file of files) images.push(await imageForModel(file))
            draft = (await api('report.analyzeImages', { personId: props.personId, images, ...(date ? { date } : {}) })).draft
          } else if (files.length === 1 && /\.(txt|md|csv|json)$/i.test(files[0].name)) {
            const content = await readFileText(files[0])
            props.onBusy('正在让模型识别报告文字…')
            draft = (await api('report.analyzeText', { personId: props.personId, text: content, ...(date ? { date } : {}) })).draft
          } else {
            throw new Error('一次请选择同一类型的报告：单个 PDF、多张照片，或单个文本文件')
          }
          props.onDraft(draft)
        } catch (failure) {
          setError(failure.message || String(failure))
        } finally {
          setBusy(false)
          props.onBusy('')
        }
      }
      return h(Modal, { title: '上传体检报告', onClose: props.onClose, width: 720 },
        h('div', { style: S.muted }, '支持 PDF、报告照片/截图（可多张）、文本文件，或直接粘贴报告文字。上传后由多模态模型识别，识别结果会先给你确认，确认后才写入健康 JSON。'),
        h('div', {
          style: {
            marginTop: 12, border: `1px dashed ${dragOver ? C.brand : C.border2}`, borderRadius: 10, padding: '22px 16px', textAlign: 'center', color: C.sub, cursor: 'pointer',
            background: dragOver ? 'color-mix(in srgb, ' + C.brand + ' 6%, transparent)' : 'transparent',
          },
          onClick: () => fileInputRef.current?.click(),
          onDragOver: (event) => { event.preventDefault(); setDragOver(true) },
          onDragLeave: () => setDragOver(false),
          onDrop: (event) => { event.preventDefault(); setDragOver(false); onFiles(event.dataTransfer.files) },
        },
          h('div', null, files.length === 0 ? '点击选择文件，或把文件拖到这里' : files.map((file) => file.name).join('、')),
          h('div', { style: { fontSize: 11, marginTop: 4 } }, 'PDF 会按页转成图片交给模型；照片会自动压缩。')),
        h('input', {
          ref: fileInputRef, type: 'file', multiple: true, style: { display: 'none' },
          accept: '.pdf,image/*,.txt,.md,.csv,.json',
          onChange: (event) => onFiles(event.target.files),
        }),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 } },
          h(Field, { label: '体检日期（可选，留空则由模型识别）' }, h(TextInput, { type: 'date', value: date, onChange: setDate }))),
        h(Field, { label: '或者粘贴报告文字' }, h('textarea', {
          style: Object.assign({}, S.input, { minHeight: 120, resize: 'vertical' }),
          value: text, placeholder: '把体检报告文字粘贴到这里（可包含多页）…',
          onChange: (event) => setText(event.target.value),
        })),
        error ? h('div', { style: { color: C.err, fontSize: 12, marginTop: 8, whiteSpace: 'pre-wrap' } }, error) : null,
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 } },
          h(Button, { onClick: props.onClose, disabled: busy }, '取消'),
          h(Button, { kind: 'primary', onClick: analyze, disabled: busy }, busy ? '识别中…' : '开始识别')))
    }

    function DraftDialog(props) {
      const draft = props.draft
      const [date, setDate] = useState(draft.date || props.today || '')
      const [notes, setNotes] = useState(draft.institution ? `体检机构：${draft.institution}` : '')
      const [summary, setSummary] = useState(draft.summary || '')
      const [rows, setRows] = useState((draft.indicators || []).map((row) => Object.assign({}, row, { value: row.value === undefined || row.value === null ? '' : String(row.value), refLow: row.refLow === undefined ? '' : String(row.refLow), refHigh: row.refHigh === undefined ? '' : String(row.refHigh) })))
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)
      const updateRow = (index, key, value) => setRows((current) => current.map((row, position) => position === index ? Object.assign({}, row, { [key]: value }) : row))
      const submit = async () => {
        const indicators = []
        for (const row of rows) {
          if (!row.name || String(row.name).trim().length === 0) continue
          if (String(row.value).trim().length === 0) continue
          const parsed = Number(row.value)
          indicators.push({
            key: row.key,
            name: String(row.name).trim(),
            value: Number.isFinite(parsed) && String(row.value).trim() !== '' ? parsed : row.value,
            unit: row.unit || '',
            ...(row.refLow === '' ? {} : { refLow: Number(row.refLow) }),
            ...(row.refHigh === '' ? {} : { refHigh: Number(row.refHigh) }),
          })
        }
        if (indicators.length === 0) {
          setError('请至少保留一项指标，或手动补充后再保存')
          return
        }
        setBusy(true)
        setError('')
        try {
          await props.onSave({ personId: props.personId, date, notes, summary, indicators, source: draft.source, rawText: draft.rawText })
        } catch (failure) {
          setError(failure.message || String(failure))
        } finally {
          setBusy(false)
        }
      }
      return h(Modal, { title: '确认识别结果', onClose: props.onClose, width: 860 },
        h('div', { style: S.muted, marginBottom: 8 }, '模型已识别出以下内容。请核对、修改或删除不准确的指标，确认无误后保存；保存时会写入健康 JSON 并自动生成、推送本次的健康风险与建议。'),
        (draft.warnings || []).length > 0 ? h('div', { style: S.warnBox }, draft.warnings.map((warning, index) => h('div', { key: String(index) }, `· ${warning}`))) : null,
        h('div', { style: S.grid3 },
          h(Field, { label: '体检日期' }, h(TextInput, { type: 'date', value: date, onChange: setDate })),
          h(Field, { label: '来源' }, h('div', { style: Object.assign({}, S.input, { color: C.sub }) }, draft.source && draft.source.fileName ? draft.source.fileName : '粘贴文字')),
          h(Field, { label: '报告结论/机构备注' }, h(TextInput, { value: notes, onChange: setNotes, placeholder: '可留空' }))),
        h(Field, { label: '本次小结（可修改）' }, h('textarea', { style: Object.assign({}, S.input, { minHeight: 52, resize: 'vertical' }), value: summary, onChange: (event) => setSummary(event.target.value) })),
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0 4px' } },
          h('span', { style: { fontWeight: 600, fontSize: 12 } }, `指标（${rows.length} 项）`),
          h(Button, { small: true, onClick: () => setRows((current) => current.concat([{ key: `custom:${Date.now()}`, name: '', value: '', unit: '', refLow: '', refHigh: '' }])) }, '添加一项')),
        h('div', { style: { maxHeight: 320, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 } },
          h('table', { style: S.table },
            h('thead', null, h('tr', null,
              h('th', { style: S.th }, '指标'), h('th', { style: S.th }, '结果'), h('th', { style: S.th }, '单位'),
              h('th', { style: S.th }, '参考下限'), h('th', { style: S.th }, '参考上限'), h('th', { style: S.th }, '状态'), h('th', { style: S.th }, ''))),
            h('tbody', null, rows.map((row, index) => h('tr', { key: String(index) },
              h('td', { style: S.td }, h(TextInput, { value: row.name, onChange: (value) => updateRow(index, 'name', value) })),
              h('td', { style: S.td }, h(TextInput, { value: row.value, onChange: (value) => updateRow(index, 'value', value) })),
              h('td', { style: S.td }, h(TextInput, { value: row.unit, onChange: (value) => updateRow(index, 'unit', value) })),
              h('td', { style: S.td }, h(TextInput, { value: row.refLow, onChange: (value) => updateRow(index, 'refLow', value) })),
              h('td', { style: S.td }, h(TextInput, { value: row.refHigh, onChange: (value) => updateRow(index, 'refHigh', value) })),
              h('td', { style: S.td }, h(Chip, { tone: statusTone(row.status) }, statusText(row.status))),
              h('td', { style: S.td }, h(Button, { small: true, kind: 'danger', onClick: () => setRows((current) => current.filter((_entry, position) => position !== index)) }, '删除'))))))),
        error ? h('div', { style: { color: C.err, fontSize: 12, marginTop: 8, whiteSpace: 'pre-wrap' } }, error) : null,
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 } },
          h(Button, { onClick: props.onClose, disabled: busy }, '取消'),
          h(Button, { kind: 'primary', onClick: submit, disabled: busy }, busy ? '保存并生成建议…' : '确认保存并生成建议')))
    }

    function PersonHeader(props) {
      const person = props.detail.person
      return h('div', null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
          h('h1', { style: S.h1 }, person.name),
          person.relation ? h(Chip, { tone: 'idle' }, person.relation) : null,
          h('span', { style: S.muted }, [sexText(person.sex), ageText(person), person.heightCm ? `${person.heightCm} cm` : ''].filter(Boolean).join(' · '))),
        h('div', { style: Object.assign({}, S.toolbar, { marginTop: 10 }) },
          h(Button, { kind: 'primary', onClick: props.onReport }, '上传体检报告'),
          h(Button, { onClick: props.onDaily }, '记录日常数据'),
          h(Button, { onClick: props.onEditPerson }, '编辑资料'),
          h(Button, { kind: 'danger', onClick: props.onDeletePerson }, '删除成员')))
    }

    function OverviewTab(props) {
      const detail = props.detail
      const records = detail.records || []
      const advice = props.advice
      const latestCheckup = records.filter((record) => record.kind === 'checkup').at(-1)
      const latestDaily = records.filter((record) => record.kind === 'daily').at(-1)
      const abnormal = latestCheckup ? abnormalOf(latestCheckup) : []

      const statCard = (label, value) => h('div', { style: S.stat },
        h('div', { style: S.statLabel }, label),
        h('div', { style: S.statValue }, value))

      const adviceCard = h('div', { style: S.card },
        h('div', { style: S.cardHead },
          h('div', { style: S.cardTitle }, '本次健康风险与建议'),
          h(Button, { small: true, onClick: () => props.onOpenTab('advice') }, '查看完整建议')),
        advice
          ? h(AdviceCard, { advice })
          : h('div', { style: S.muted }, '还没有生成建议。上传一次体检报告，或记录日常数据后会自动生成并推送。'))

      const abnormalCard = abnormal.length === 0 ? null : h('div', { style: S.card },
        h('div', { style: S.cardHead }, h('div', { style: S.cardTitle }, `最近体检异常指标（${abnormal.length}）`)),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
          abnormal.map((indicator, index) => h(Chip, {
            key: String(index), tone: statusTone(indicator.status),
          }, `${indicator.name} ${indicator.value}${indicator.unit || ''} ${statusText(indicator.status)}`))))

      const hasTrend = seriesOf(records, 'weight_kg').length + seriesOf(records, 'sbp').length + seriesOf(records, 'fasting_glucose').length > 0
      const trendCard = hasTrend ? h('div', { style: S.card },
        h('div', { style: S.cardHead }, h('div', { style: S.cardTitle }, '趋势')),
        h('div', { style: S.grid3 },
          h(TrendChart, { title: '体重', unit: ' kg', points: seriesOf(records, 'weight_kg') }),
          h(TrendChart, { title: '收缩压', unit: ' mmHg', points: seriesOf(records, 'sbp') }),
          h(TrendChart, { title: '空腹血糖', unit: ' mmol/L', points: seriesOf(records, 'fasting_glucose') }))) : null

      const recentRows = records.slice(-3).reverse().map((record) => {
        const text = record.summary || (record.notes ? String(record.notes).slice(0, 80) : '') || `${(record.indicators || []).length} 项指标`
        return h('div', { key: record.id, style: S.listItem },
          h('span', { style: S.dot(record.kind === 'checkup' ? C.brand : C.idle) }),
          h('div', null,
            h('div', null,
              h('strong', null, record.date), ' ',
              h(Chip, { tone: record.kind === 'checkup' ? 'ok' : 'idle' }, kindText(record.kind)),
              record.abnormalCount > 0 ? h(Chip, { tone: 'warn' }, `异常 ${record.abnormalCount}`) : null),
            h('div', { style: { color: C.sub, fontSize: 12 } }, text)))
      })

      const recentCard = h('div', { style: S.card },
        h('div', { style: S.cardHead },
          h('div', { style: S.cardTitle }, '最近记录'),
          h(Button, { small: true, onClick: () => props.onOpenTab('history') }, '全部历史')),
        records.length === 0 ? h('div', { style: S.muted }, '暂无记录') : recentRows)

      return h('div', null,
        h('div', { style: S.stats },
          statCard('健康记录', `${records.length} 条`),
          statCard('最近体检', latestCheckup ? latestCheckup.date : '—'),
          statCard('最近日常', latestDaily ? latestDaily.date : '—'),
          statCard('最近建议', advice && advice.recordDate ? advice.recordDate : '—')),
        adviceCard,
        abnormalCard,
        trendCard,
        recentCard)
    }

    function HistoryTab(props) {
      const records = (props.detail.records || []).slice().reverse()
      const [expandedId, setExpandedId] = useState(null)
      const [adviceModal, setAdviceModal] = useState(null)
      const [busyId, setBusyId] = useState('')
      const openAdvice = async (record) => {
        if (!record.adviceId) return
        try {
          const data = await api('advice.get', { personId: props.detail.person.id, adviceId: record.adviceId })
          setAdviceModal(data.advice)
        } catch (error) {
          props.onError(error.message)
        }
      }
      const regenerate = async (record) => {
        setBusyId(record.id)
        props.onBusy('正在重新生成健康风险与建议…')
        try {
          const data = await api('advice.generate', { personId: props.detail.person.id, recordId: record.id })
          props.onRefresh()
          setAdviceModal(data.advice)
        } catch (error) {
          props.onError(error.message)
        } finally {
          setBusyId('')
          props.onBusy('')
        }
      }
      return h('div', null,
        records.length === 0 ? h('div', { style: S.empty }, '暂无健康记录') : records.map((record) => h('div', { key: record.id, style: S.card },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h('strong', null, record.date),
            h(Chip, { tone: record.kind === 'checkup' ? 'ok' : 'idle' }, kindText(record.kind)),
            record.abnormalCount > 0 ? h(Chip, { tone: 'warn' }, `异常 ${record.abnormalCount}`) : null,
            (record.systems || []).length > 0 ? h('span', { style: S.muted }, `${record.systems.length} 个系统相关`) : null,
            h('span', { style: { marginLeft: 'auto', display: 'flex', gap: 6 } },
              h(Button, { small: true, onClick: () => setExpandedId(expandedId === record.id ? null : record.id) }, expandedId === record.id ? '收起' : '详情'),
              record.adviceId ? h(Button, { small: true, onClick: () => openAdvice(record) }, '查看建议') : null,
              h(Button, { small: true, onClick: () => regenerate(record), disabled: busyId === record.id }, busyId === record.id ? '生成中…' : '重生成建议'),
              h(Button, { small: true, kind: 'danger', onClick: () => props.onDeleteRecord(record) }, '删除'))),
          expandedId === record.id ? h('div', { style: { marginTop: 10 } },
            record.summary ? h('div', { style: { marginBottom: 6 } }, record.summary) : null,
            record.notes ? h('div', { style: S.muted }, record.notes) : null,
            h('table', { style: Object.assign({}, S.table, { marginTop: 8 }) },
              h('thead', null, h('tr', null, h('th', { style: S.th }, '指标'), h('th', { style: S.th }, '结果'), h('th', { style: S.th }, '参考'), h('th', { style: S.th }, '状态'))),
              h('tbody', null, (record.indicators || []).map((indicator, index) => h('tr', { key: String(index) },
                h('td', { style: S.td }, indicator.name),
                h('td', { style: S.td }, `${indicator.value}${indicator.unit ? ` ${indicator.unit}` : ''}`),
                h('td', { style: S.td }, fmtRange(indicator) || '—'),
                h('td', { style: S.td }, h(Chip, { tone: statusTone(indicator.status) }, statusText(indicator.status))))))),
            (() => {
              const link = sourceLink(props.detail.person.id, record)
              return link ? h('div', { style: { marginTop: 8 } }, h('a', { style: S.link, href: link, target: '_blank', rel: 'noreferrer' }, '查看原始报告文件')) : null
            })()) : null)),
        adviceModal ? h(Modal, { title: '健康建议', onClose: () => setAdviceModal(null), width: 860 },
          h('div', { style: S.muted, marginBottom: 8 }, adviceModal.recordDate ? `基于 ${adviceModal.recordDate} 的记录` : ''),
          h(AdviceCard, { advice: adviceModal })) : null)
    }

    function AdviceTab(props) {
      const advice = props.advice
      return h('div', null,
        h('div', { style: S.card },
          h('div', { style: S.cardHead },
            h('div', { style: S.cardTitle }, '健康风险与建议'),
            h(Button, { small: true, onClick: props.onRegenerate, disabled: props.busy }, props.busy ? '生成中…' : '重新生成')),
          advice ? h(AdviceCard, { advice }) : h('div', { style: S.muted }, '暂无建议。保存一次体检记录或点击上方「重新生成」即可生成。')))
    }

    function MemberList(props) {
      return h('aside', { style: S.aside },
        h('div', { style: S.asideHead },
          h('div', { style: S.asideTitle }, '健康管理'),
          h(Button, { small: true, kind: 'primary', onClick: props.onAdd }, '添加')),
        h('div', { style: S.asideList },
          props.people.length === 0 ? h('div', { style: { padding: '18px 10px', color: C.sub, fontSize: 12 } }, '还没有成员，先添加一个吧。') : props.people.map((person) => h('button', {
            key: person.id, type: 'button', style: S.member(person.id === props.selectedId), onClick: () => props.onSelect(person.id),
          },
          h('span', { style: S.memberName }, person.name,
            person.abnormalLatest > 0 ? h(Chip, { tone: 'warn' }, `异常 ${person.abnormalLatest}`) : null),
          h('span', { style: S.memberMeta }, [sexText(person.sex), ageText(person), person.recordCount ? `${person.recordCount} 条记录` : '暂无记录'].filter(Boolean).join(' · '))))))
    }

    function HealthPanel() {
      const [view, setView] = useState({ status: 'loading', people: [], dataDir: '', today: '', model: undefined, error: '' })
      const [selectedId, setSelectedId] = useState(null)
      const [detail, setDetail] = useState(null)
      const [tab, setTab] = useState('overview')
      const [notice, setNotice] = useState(null)
      const [busyText, setBusyText] = useState('')
      const [dialog, setDialog] = useState(null)
      const [draft, setDraft] = useState(null)
      const [confirm, setConfirm] = useState(null)
      const noticeTimer = useRef(null)

      const showNotice = useCallback((kind, text) => {
        setNotice({ kind, text })
        if (noticeTimer.current) clearTimeout(noticeTimer.current)
        noticeTimer.current = setTimeout(() => setNotice(null), 5000)
      }, [])

      const loadState = useCallback(async () => {
        try {
          const data = await api('state')
          setView({ status: 'ready', people: data.people || [], dataDir: data.dataDir || '', today: data.today || '', model: data.model, error: '' })
          return data
        } catch (error) {
          setView((current) => Object.assign({}, current, { status: 'ready', error: error.message }))
          throw error
        }
      }, [])

      const loadDetail = useCallback(async (personId) => {
        if (!personId) {
          setDetail(null)
          return
        }
        try {
          const data = await api('person.get', { id: personId })
          setDetail(data)
        } catch (error) {
          showNotice('err', error.message)
          setDetail(null)
        }
      }, [showNotice])

      useEffect(() => {
        loadState().then((data) => {
          setSelectedId((current) => current || (data && data.people.length > 0 ? data.people[0].id : null))
        }).catch(() => {})
        return () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }
      }, [])

      useEffect(() => {
        loadDetail(selectedId)
      }, [selectedId, loadDetail])

      const refreshAll = useCallback(async () => {
        const data = await loadState()
        if (selectedId) await loadDetail(selectedId)
        return data
      }, [loadState, loadDetail, selectedId])

      const createPerson = async (form) => {
        const data = await api('person.create', form)
        setDialog(null)
        await loadState()
        setSelectedId(data.person.id)
        showNotice('ok', `已添加成员「${data.person.name}」`)
      }

      const updatePerson = async (form) => {
        await api('person.update', form)
        setDialog(null)
        await refreshAll()
        showNotice('ok', '成员资料已更新')
      }

      const deletePerson = async () => {
        if (!detail) return
        setConfirm(null)
        await api('person.delete', { id: detail.person.id })
        setSelectedId(null)
        setDetail(null)
        await loadState()
        showNotice('ok', '成员及其健康数据已删除')
      }

      const saveDaily = async (payload) => {
        setBusyText('正在保存并生成健康建议…')
        try {
          const data = await api('record.add', { personId: detail.person.id, kind: 'daily', ...payload })
          setDialog(null)
          await refreshAll()
          if (data.warnings && data.warnings.length > 0) showNotice('err', data.warnings.join('；'))
          else showNotice('ok', '已保存日常数据，并推送本次健康风险与建议')
          setTab('advice')
        } finally {
          setBusyText('')
        }
      }

      const confirmDraft = async (payload) => {
        setBusyText('正在保存并生成健康风险与建议…')
        try {
          const data = await api('record.confirm', payload)
          setDraft(null)
          setDialog(null)
          await refreshAll()
          if (data.warnings && data.warnings.length > 0) showNotice('err', data.warnings.join('；'))
          else showNotice('ok', '体检记录已保存，本次健康风险与建议已推送')
          setTab('advice')
        } finally {
          setBusyText('')
        }
      }

      const deleteRecord = (record) => {
        setConfirm({
          title: '删除记录',
          text: `确定删除 ${record.date} 的这条${kindText(record.kind)}记录吗？该记录对应的建议也会一起删除。`,
          onConfirm: async () => {
            setConfirm(null)
            try {
              await api('record.delete', { personId: detail.person.id, recordId: record.id })
              await refreshAll()
              showNotice('ok', '记录已删除')
            } catch (error) {
              showNotice('err', error.message)
            }
          },
        })
      }

      const regenerate = async () => {
        if (!detail) return
        const records = detail.records || []
        const target = records.filter((record) => record.kind === 'checkup').at(-1) || records.at(-1)
        if (!target) {
          showNotice('err', '还没有任何记录，先保存一次体检记录')
          return
        }
        setBusyText('正在基于长寿管理框架生成健康风险与建议…')
        try {
          await api('advice.generate', { personId: detail.person.id, recordId: target.id })
          await refreshAll()
          showNotice('ok', '已重新生成并推送健康风险与建议')
          setTab('advice')
        } catch (error) {
          showNotice('err', error.message)
        } finally {
          setBusyText('')
        }
      }

      const person = detail && detail.person
      const advice = detail && detail.advice
      const modelText = view.model && view.model.model ? `${view.model.provider} / ${view.model.model}${view.model.imageSupported === false ? '（不支持图片）' : ''}` : view.model && view.model.error ? view.model.error : '—'

      return h('div', { style: S.page },
        h(MemberList, {
          people: view.people,
          selectedId,
          onSelect: (id) => { setSelectedId(id); setTab('overview') },
          onAdd: () => setDialog('person-create'),
        }),
        h('div', { style: S.main },
          h('div', { style: S.header },
            h('div', { style: { flex: 1, minWidth: 220 } },
              person ? h(PersonHeader, {
                detail, onReport: () => setDialog('report'), onDaily: () => setDialog('daily'),
                onEditPerson: () => setDialog('person-edit'), onDeletePerson: () => setConfirm({
                  title: '删除成员',
                  text: `确定删除「${person.name}」及其全部健康数据（health.json 与报告文件）吗？此操作不可恢复。`,
                  onConfirm: deletePerson,
                }),
              }) : h('div', null,
                h('h1', { style: S.h1 }, '健康管理'),
                h('div', { style: S.muted }, '管理多人的体检报告与日常健康数据，每次更新后基于《长寿管理》框架推送健康风险与建议。')),
              h('div', { style: Object.assign({}, S.metaRow, { marginTop: 8 }) },
                h('span', null, `模型：${modelText}`),
                h('span', null, `数据目录：${view.dataDir || '—'}`))),
            h('div', { style: S.toolbar },
              h(Button, { small: true, onClick: () => { refreshAll().then(() => showNotice('ok', '已刷新')).catch((error) => showNotice('err', error.message)) } }, '刷新'))),
          view.error ? h('div', { style: Object.assign({}, S.warnBox, { margin: '10px 24px 0' }) }, `无法连接插件服务：${view.error}`) : null,
          person ? h('div', { style: S.tabs },
            [['overview', '概览'], ['history', '历史记录'], ['advice', '健康建议']].map(([key, label]) => h('button', { key, type: 'button', style: S.tab(tab === key), onClick: () => setTab(key) }, label))) : null,
          h('div', { style: S.scroll },
            h('div', { style: S.content },
              !person ? h('div', { style: S.empty }, view.status === 'loading' ? '加载中…' : '先在左侧添加一个成员，或选择已有成员。')
                : tab === 'overview' ? h(OverviewTab, { detail, advice, onOpenTab: setTab })
                  : tab === 'history' ? h(HistoryTab, { detail, onRefresh: refreshAll, onDeleteRecord: deleteRecord, onBusy: setBusyText, onError: (text) => showNotice('err', text) })
                    : h(AdviceTab, { advice, onRegenerate: regenerate, busy: busyText.length > 0 })))),
        dialog === 'person-create' ? h(PersonForm, { onClose: () => setDialog(null), onSubmit: createPerson }) : null,
        dialog === 'person-edit' && person ? h(PersonForm, { initial: person, onClose: () => setDialog(null), onSubmit: updatePerson }) : null,
        dialog === 'daily' && person ? h(DailyForm, { today: view.today, onClose: () => setDialog(null), onSubmit: saveDaily }) : null,
        dialog === 'report' && person ? h(ReportDialog, {
          personId: person.id,
          onClose: () => setDialog(null),
          onBusy: setBusyText,
          onDraft: (nextDraft) => { setDialog(null); setDraft(nextDraft) },
        }) : null,
        draft ? h(DraftDialog, { draft, personId: person ? person.id : draft.personId, today: view.today, onClose: () => setDraft(null), onSave: confirmDraft }) : null,
        confirm ? h(Modal, { title: confirm.title, onClose: () => setConfirm(null) },
          h('div', { style: { fontSize: 13, marginBottom: 16 } }, confirm.text),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8 } },
            h(Button, { onClick: () => setConfirm(null) }, '取消'),
            h(Button, { kind: 'danger', onClick: confirm.onConfirm }, '确认删除'))) : null,
        notice ? h('div', { style: S.notice(notice.kind) }, notice.text) : null,
        busyText ? h('div', { style: S.busy }, h('span', { style: { width: 8, height: 8, borderRadius: 8, background: C.brand, display: 'inline-block' } }), busyText) : null)
    }

    function PanelIcon(props) {
      const size = props && props.size ? props.size : 18
      const active = props && props.active
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true,
        style: { display: 'block', color: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)' },
      },
      h('path', {
        d: 'M12 20.5s-7.5-4.7-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 3.1c0 5.5-7.5 10.2-7.5 10.2z',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinejoin: 'round',
      }),
      h('path', { d: 'M8.5 12.5h2l1.1-2.4 1.7 4.6 1.2-2.2h2.2', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, HealthPanel))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 6, label: () => '健康管理',
        }, PanelIcon))
      },
    }
  },
})
