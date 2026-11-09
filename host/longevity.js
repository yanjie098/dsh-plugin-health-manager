/**
 * The longevity-management framework that grounds every generated risk and
 * advice: twelve body systems in three layers, their key indicators, and the
 * tiered monitoring plan. Structured so the panel and the prompt can select the
 * systems that the current health JSON actually touches.
 *
 * This is reference guidance, not a medical diagnosis.
 */

/** Three layers of the twelve systems. */
export const LAYERS = [
  { key: 'base', name: '底层基础设施', summary: '细胞供能、废物清除、基因稳定与微生态，决定衰老速度的上限。' },
  { key: 'core', name: '中层核心功能', summary: '能量分配、损伤响应与物质运输，连接基础与功能表现。' },
  { key: 'high', name: '高层功能表现', summary: '循环、免疫、代谢中枢、运动储备与神经系统，决定健康寿命的表现。' },
]

/**
 * @typedef {object} LongevitySystem
 * @property {string} key
 * @property {string} name
 * @property {'base'|'core'|'high'} layer
 * @property {string} why        why it matters
 * @property {string[]} indicators  key indicators
 * @property {string} goal       lifestyle levers that improve it
 */

/** @type {LongevitySystem[]} */
export const SYSTEMS = [
  {
    key: 'mitochondria', name: '细胞能量与线粒体系统', layer: 'base',
    why: '线粒体是能量的来源，功能下降会带来疲劳、代谢变慢和全身性老化加速。',
    indicators: ['NAD+ 水平（直接或 NAM、色氨酸等前体代谢物）', '乳酸/丙酮酸比值', '辅酶 Q10', '最大摄氧量（VO₂max）', '运动后心率恢复速度', '白细胞线粒体 DNA 拷贝数'],
    goal: '规律有氧与间歇性高强度训练、充足睡眠、减少精制糖与酒精负荷、必要时补充 CoQ10。',
  },
  {
    key: 'autophagy', name: '细胞自噬与废物清除系统', layer: 'base',
    why: '自噬负责清理受损细胞器和错误折叠蛋白，受阻会加速神经退行性改变与代谢紊乱。',
    indicators: ['LC3-II/I 比值（科研）', 'p62 水平', 'GDF15', '断食后酮体升高幅度（间接参考）', '皮肤老化表现'],
    goal: '适度热量限制与进食窗口管理、规律运动、保证睡眠，避免长期高糖高脂饮食。',
  },
  {
    key: 'epigenetics', name: '表观遗传与 DNA 修复系统', layer: 'base',
    why: '表观遗传时钟和 DNA 损伤累积决定生物学年龄；修复能力下降是多种老年病的共同基础。',
    indicators: ['表观遗传时钟（Horvath、PhenoAge）', '端粒长度（解读需谨慎）', 'γ-H2AX', '8-OHdG（DNA 氧化损伤）'],
    goal: '避免吸烟与过量酒精、控制紫外线暴露、规律运动与充足睡眠、抗氧化饮食。',
  },
  {
    key: 'gut', name: '肠道微生态与屏障系统', layer: 'base',
    why: '肠道屏障和菌群参与免疫、炎症与营养吸收，是全身慢性炎症的重要来源。',
    indicators: ['zonulin（肠道通透性）', 'LPS / LBP（内毒素）', '粪便钙卫蛋白', '宏基因组测序（菌群多样性、厚壁菌/拟杆菌比、SCFAs 产生菌）', '粪便短链脂肪酸浓度'],
    goal: '多样化膳食纤维与发酵食物、减少超加工食品、谨慎使用抗生素、规律作息。',
  },
  {
    key: 'metabolism', name: '代谢失衡系统', layer: 'core',
    why: '胰岛素抵抗、高血糖与肥胖会损伤线粒体、加剧氧化应激和糖基化，是心血管病、糖尿病、癌症与神经退行性疾病的共同土壤。',
    indicators: ['空腹血糖与胰岛素（HOMA-IR 胰岛素抵抗指数）', 'HbA1c（近 2–3 个月平均血糖）', '腰围/身高比（优于 BMI 的内脏脂肪指标）', '尿酸', 'OGTT（口服葡萄糖耐量试验）', '内脏脂肪面积'],
    goal: '减少精制碳水与含糖饮料、增加力量与有氧训练、控制腰围、必要时评估间歇性断食。',
  },
  {
    key: 'inflammation', name: '炎症与 SASP 系统', layer: 'core',
    why: '慢性低度炎症（炎症性衰老）会通过 SASP 因子扩散损伤，推动动脉粥样硬化、胰岛素抵抗和免疫衰退。',
    indicators: ['超敏 C 反应蛋白 hs-CRP（>2 mg/L 提示心血管风险升高）', 'IL-6', 'TNF-α', 'GDF15', '纤维蛋白原'],
    goal: '地中海式饮食、Omega-3 摄入、规律运动、改善睡眠、处理牙周炎等隐藏炎症源。',
  },
  {
    key: 'lipids', name: '脂蛋白结构与脂质转运系统', layer: 'core',
    why: '风险不只取决于胆固醇浓度，更取决于致动脉粥样硬化颗粒的数量与大小，以及 HDL 的功能。',
    indicators: ['血脂四项（TC、TG、LDL-C、HDL-C）', 'ApoB（颗粒总数，比 LDL-C 更准确）', 'Lp(a)（遗传决定的独立风险）', 'LDL 颗粒大小/数量（核磁脂谱）', 'HDL 胆固醇外流能力（科研）'],
    goal: '减少饱和脂肪与反式脂肪、增加可溶性膳食纤维、规律运动，按 ApoB/Lp(a) 制定干预目标。',
  },
  {
    key: 'cardiovascular', name: '心血管老化系统', layer: 'high',
    why: '血管硬化、内皮功能下降和动脉粥样硬化决定心梗、中风与器官灌注，是健康寿命的基础。',
    indicators: ['血压（收缩压、舒张压、脉压差）', '脉搏波传导速度（动脉硬化金标准）', '颈动脉内膜中层厚度（超声）', 'NT-proBNP（心脏负荷）', '高敏肌钙蛋白 I/T', '静息心率'],
    goal: '限盐、有氧运动、控制体重与血脂血压、戒烟限酒、管理压力。',
  },
  {
    key: 'immune', name: '免疫衰老系统', layer: 'high',
    why: '免疫系统随年龄衰退：幼稚 T 细胞减少、记忆细胞堆积，感染与癌症风险上升、疫苗效力下降。',
    indicators: ['淋巴细胞亚群（CD4/CD8 比值，正常约 1.5–2.0，<1 提示免疫衰老）', '幼稚 T 细胞/记忆 T 细胞比例', '自然杀伤细胞活性', '中性粒细胞/淋巴细胞比值（NLR）', 'CMV / EBV 抗体滴度'],
    goal: '规律运动与力量训练、充足蛋白质与维生素 D、接种疫苗、保证睡眠、管理慢性压力。',
  },
  {
    key: 'liver', name: '肝脏与蛋白稳态系统', layer: 'high',
    why: '肝脏是代谢中枢与蛋白质工厂；蛋白稳态失衡既关联脂肪肝与纤维化，也关联神经退行性疾病。',
    indicators: ['肝功能全套（ALT、AST、GGT、ALP）', '白蛋白', '凝血四项（PT、APTT）', '肝脏瞬时弹性扫描（硬度与 CAP 脂肪含量）'],
    goal: '减糖限酒、控制体重、规律作息、避免不必要的药物与保健品负担。',
  },
  {
    key: 'muscle', name: '肌肉与体能储备系统', layer: 'high',
    why: '肌肉是最大的代谢器官和蛋白质储备库；肌少症与力量下降直接关联代谢紊乱、跌倒风险和全因死亡率。',
    indicators: ['四肢骨骼肌质量（DEXA）', '握力', '步速（4 米步行测试）', '五次坐站测试', '日常步数与活动量'],
    goal: '每周 2–3 次抗阻训练、充足蛋白质（分散到各餐）、保证维生素 D 与睡眠。',
  },
  {
    key: 'neuro', name: '神经与心理健康系统', layer: 'high',
    why: '神经退行性疾病与抑郁焦虑是主要致残原因；慢性压力通过皮质醇损害全身健康并加速衰老。',
    indicators: ['认知评估（MoCA / MMSE）', 'BDNF', '维生素 B12、叶酸、维生素 D', 'NFL（神经丝轻链）', 'PHQ-9（抑郁）、GAD-7（焦虑）、PSS（压力）', '睡眠监测（深睡时长、睡眠效率）', '心率变异性（HRV）'],
    goal: '有氧运动提升 BDNF、保证 7–9 小时睡眠、地中海饮食、正念与社交、补充缺乏的 B12/叶酸/维生素 D。',
  },
]

/** Fast lookup by system key. */
export const SYSTEM_BY_KEY = new Map(SYSTEMS.map((system) => [system.key, system]))

/** Tiered monitoring plan from the framework. */
export const MONITORING_TIERS = [
  {
    key: 'annual', name: '年度/半年度体检（必查项）',
    items: ['血常规', '血糖、HbA1c、胰岛素', '血脂四项 + ApoB', 'hs-CRP', '肝功能（ALT/AST/GGT）', '肾功能（肌酐/胱抑素 C）', '尿酸', '维生素 D、B12', '血压、腰围、握力、步速'],
  },
  {
    key: 'deep', name: '年度/特殊时期（深度排查项）',
    items: ['颈动脉超声', '脉搏波传导速度', 'DEXA 身体成分（肌肉/脂肪/骨密度）', '淋巴细胞亚群分析', '甲状腺功能全项', '皮质醇节律'],
  },
  {
    key: 'daily', name: '可穿戴设备/日常追踪（动态趋势项）',
    items: ['静息心率、心率变异性', '最大摄氧量', '睡眠结构', '日常步数/活动量'],
  },
  {
    key: 'advanced', name: '进阶指标（预算充足或科研目的）',
    items: ['表观遗传时钟（生物年龄）', '核磁共振脂谱（LDL 颗粒数）', '肠道宏基因组测序', '基于适体的血浆蛋白质组学'],
  },
]

/** Human-readable layer name for one system. */
export function layerName(system) {
  return LAYERS.find((layer) => layer.key === system.layer)?.name ?? ''
}

/**
 * Render the framework as prompt text. The model is told to ground its advice
 * in exactly this framework.
 */
export function frameworkText() {
  const lines = []
  lines.push('《长寿管理》框架（建议必须基于此框架组织）：')
  lines.push('整体视角：底层基础设施提供动力与清洁（细胞能量、自噬、表观遗传、肠道）；中层核心功能负责能量分配、损伤响应与物质运输（代谢、炎症、脂蛋白）；高层功能表现决定生活质量（心血管、免疫、肝脏、肌肉、神经心理）。')
  for (const layer of LAYERS) {
    lines.push('')
    lines.push(`【${layer.name}】${layer.summary}`)
    for (const system of SYSTEMS.filter((entry) => entry.layer === layer.key)) {
      lines.push(`- ${system.name}：${system.why}`)
      lines.push(`  关键指标：${system.indicators.join('；')}。`)
      lines.push(`  改善方向：${system.goal}`)
    }
  }
  lines.push('')
  lines.push('【三级监测体系】')
  for (const tier of MONITORING_TIERS) {
    lines.push(`- ${tier.name}：${tier.items.join('、')}。`)
  }
  return lines.join('\n')
}

/**
 * Systems the given indicator keys touch, in framework order.
 * @param {string[]} keys
 * @returns {LongevitySystem[]}
 */
export function systemsForKeys(keys) {
  const matched = []
  for (const system of SYSTEMS) {
    if (system.indicators.some((label) => keys.some((key) => label.includes(key) || key.includes(label)))) matched.push(system)
  }
  return matched
}
