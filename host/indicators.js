/**
 * Health indicator catalog, value normalization, reference ranges and derived
 * metrics. Pure data + pure functions: no Cordis, no I/O.
 *
 * The catalog covers ordinary physical-examination items plus the indicators
 * named by the longevity-management framework. Reference ranges are common
 * Chinese adult ranges and are guidance only, never a diagnosis.
 */

/** @typedef {{ low?: number, high?: number }} Range */

/**
 * @typedef {object} CatalogEntry
 * @property {string} key
 * @property {string} name
 * @property {string} unit
 * @property {string} group
 * @property {string[]} aliases
 * @property {string[]} [systems] longevity system keys this indicator touches
 * @property {'number'|'text'} [kind]
 * @property {Range} [ref]
 * @property {{ male?: Range, female?: Range }} [refBySex]
 * @property {number} [decimals]
 * @property {string[]} [normalValues]
 * @property {boolean} [daily]
 * @property {boolean} [derived] computed locally from other indicators
 */

/** Group display labels. */
export const GROUPS = {
  vital: '基本体征',
  blood: '血糖与代谢',
  lipid: '血脂与脂蛋白',
  liver: '肝脏与蛋白稳态',
  kidney: '肾脏与尿酸',
  cbc: '血常规',
  urine: '尿常规',
  thyroid: '甲状腺',
  tumor: '肿瘤标志物',
  cardio: '心血管',
  inflammation: '炎症',
  immune: '免疫',
  muscle: '肌肉与体能',
  neuro: '神经与心理',
  longevity: '长寿专项',
  daily: '日常记录',
}

/** @type {CatalogEntry[]} */
export const CATALOG = [
  // ---- 基本体征 ----
  { key: 'height_cm', name: '身高', unit: 'cm', group: 'vital', decimals: 1, aliases: ['身高', 'height', 'Height', '身长'], systems: ['metabolism'] },
  { key: 'weight_kg', name: '体重', unit: 'kg', group: 'vital', daily: true, decimals: 1, aliases: ['体重', 'weight', 'Weight', '净重'], systems: ['metabolism', 'muscle'] },
  { key: 'bmi', name: 'BMI', unit: 'kg/m²', group: 'vital', decimals: 1, aliases: ['BMI', '体质指数', '身体质量指数', '体重指数'], ref: { low: 18.5, high: 23.9 }, derived: true, systems: ['metabolism'] },
  { key: 'waist_cm', name: '腰围', unit: 'cm', group: 'vital', daily: true, decimals: 1, aliases: ['腰围', 'waist'], refBySex: { male: { low: 0, high: 89 }, female: { low: 0, high: 84 } }, systems: ['metabolism'] },
  { key: 'waist_height_ratio', name: '腰围/身高比', unit: '', group: 'vital', decimals: 2, aliases: ['腰高比', '腰围身高比', 'WHtR'], ref: { low: 0, high: 0.5 }, derived: true, systems: ['metabolism'] },
  { key: 'sbp', name: '收缩压', unit: 'mmHg', group: 'vital', daily: true, decimals: 0, aliases: ['收缩压', '高压', 'SBP', 'systolic'], ref: { low: 90, high: 139 }, systems: ['cardiovascular'] },
  { key: 'dbp', name: '舒张压', unit: 'mmHg', group: 'vital', daily: true, decimals: 0, aliases: ['舒张压', '低压', 'DBP', 'diastolic'], ref: { low: 60, high: 89 }, systems: ['cardiovascular'] },
  { key: 'pulse_pressure', name: '脉压差', unit: 'mmHg', group: 'vital', decimals: 0, aliases: ['脉压差', '脉压'], ref: { low: 30, high: 60 }, derived: true, systems: ['cardiovascular'] },
  { key: 'heart_rate', name: '静息心率', unit: '次/分', group: 'vital', daily: true, decimals: 0, aliases: ['心率', '脉搏', '静息心率', 'HR', 'heart rate', 'pulse', 'resting heart rate'], ref: { low: 60, high: 100 }, systems: ['cardiovascular'] },
  // ---- 血糖与代谢 ----
  { key: 'fasting_glucose', name: '空腹血糖', unit: 'mmol/L', group: 'blood', daily: true, decimals: 2, aliases: ['空腹血糖', '血糖', '葡萄糖', 'GLU', 'FBG', 'FPG'], ref: { low: 3.9, high: 6.1 }, systems: ['metabolism'] },
  { key: 'insulin', name: '空腹胰岛素', unit: 'μIU/mL', group: 'blood', decimals: 2, aliases: ['空腹胰岛素', '胰岛素', 'insulin', 'FINS'], ref: { low: 2.6, high: 24.9 }, systems: ['metabolism'] },
  { key: 'homa_ir', name: 'HOMA-IR（胰岛素抵抗指数）', unit: '', group: 'blood', decimals: 2, aliases: ['HOMA-IR', 'HOMA', '胰岛素抵抗指数'], ref: { low: 0, high: 2 }, derived: true, systems: ['metabolism'] },
  { key: 'hba1c', name: '糖化血红蛋白', unit: '%', group: 'blood', decimals: 1, aliases: ['糖化血红蛋白', 'HbA1c', 'HBA1C', '糖化'], ref: { low: 4, high: 6 }, systems: ['metabolism'] },
  { key: 'postprandial_glucose', name: '餐后2小时血糖', unit: 'mmol/L', group: 'blood', daily: true, decimals: 2, aliases: ['餐后2小时血糖', '餐后血糖', '2hPG'], ref: { low: 3.9, high: 7.8 }, systems: ['metabolism'] },
  { key: 'ogtt_2h', name: 'OGTT 2小时血糖', unit: 'mmol/L', group: 'blood', decimals: 2, aliases: ['OGTT', '糖耐量', '口服葡萄糖耐量'], ref: { low: 3.9, high: 7.8 }, systems: ['metabolism'] },
  // ---- 血脂与脂蛋白 ----
  { key: 'tc', name: '总胆固醇', unit: 'mmol/L', group: 'lipid', decimals: 2, aliases: ['总胆固醇', '胆固醇', 'TC', 'CHOL', 'TCHO'], ref: { low: 2.8, high: 5.2 }, systems: ['lipids'] },
  { key: 'tg', name: '甘油三酯', unit: 'mmol/L', group: 'lipid', decimals: 2, aliases: ['甘油三酯', 'TG', 'TRIG'], ref: { low: 0.4, high: 1.7 }, systems: ['lipids', 'metabolism'] },
  { key: 'ldl_c', name: '低密度脂蛋白胆固醇', unit: 'mmol/L', group: 'lipid', decimals: 2, aliases: ['低密度脂蛋白', 'LDL', 'LDL-C', 'LDL-C'], ref: { low: 0, high: 3.4 }, systems: ['lipids'] },
  { key: 'hdl_c', name: '高密度脂蛋白胆固醇', unit: 'mmol/L', group: 'lipid', decimals: 2, aliases: ['高密度脂蛋白', 'HDL', 'HDL-C'], refBySex: { male: { low: 1.0, high: 1.9 }, female: { low: 1.3, high: 1.9 } }, systems: ['lipids'] },
  { key: 'apob', name: '载脂蛋白B(ApoB)', unit: 'g/L', group: 'lipid', decimals: 2, aliases: ['载脂蛋白B', 'ApoB', 'APOB'], ref: { low: 0, high: 1.0 }, systems: ['lipids'] },
  { key: 'lpa', name: '脂蛋白a(Lp(a))', unit: 'mg/dL', group: 'lipid', decimals: 0, aliases: ['脂蛋白a', '脂蛋白(a)', 'Lp(a)', 'LPA'], ref: { low: 0, high: 30 }, systems: ['lipids'] },
  { key: 'ldl_size', name: 'LDL颗粒大小/数量', unit: '', group: 'lipid', kind: 'text', aliases: ['LDL颗粒', 'LDL粒径', '核磁脂谱', 'LDL-P'], systems: ['lipids'] },
  // ---- 肝脏与蛋白稳态 ----
  { key: 'alt', name: '谷丙转氨酶(ALT)', unit: 'U/L', group: 'liver', decimals: 1, aliases: ['谷丙转氨酶', '丙氨酸氨基转移酶', 'ALT', 'GPT'], ref: { low: 7, high: 40 }, systems: ['liver', 'metabolism'] },
  { key: 'ast', name: '谷草转氨酶(AST)', unit: 'U/L', group: 'liver', decimals: 1, aliases: ['谷草转氨酶', '天门冬氨酸氨基转移酶', 'AST', 'GOT'], ref: { low: 13, high: 35 }, systems: ['liver'] },
  { key: 'ggt', name: 'γ-谷氨酰转肽酶(GGT)', unit: 'U/L', group: 'liver', decimals: 1, aliases: ['γ-谷氨酰转肽酶', '谷氨酰转肽酶', 'GGT', 'r-GT'], refBySex: { male: { low: 7, high: 45 }, female: { low: 7, high: 32 } }, systems: ['liver'] },
  { key: 'alp', name: '碱性磷酸酶(ALP)', unit: 'U/L', group: 'liver', decimals: 1, aliases: ['碱性磷酸酶', 'ALP', 'AKP'], ref: { low: 45, high: 125 }, systems: ['liver'] },
  { key: 'tbil', name: '总胆红素', unit: 'μmol/L', group: 'liver', decimals: 1, aliases: ['总胆红素', 'TBIL', 'T-BIL'], ref: { low: 5, high: 21 }, systems: ['liver'] },
  { key: 'albumin', name: '白蛋白', unit: 'g/L', group: 'liver', decimals: 1, aliases: ['白蛋白', 'ALB', 'Albumin'], ref: { low: 40, high: 55 }, systems: ['liver'] },
  { key: 'pt', name: '凝血酶原时间(PT)', unit: 's', group: 'liver', decimals: 1, aliases: ['凝血酶原时间', 'PT', '凝血四项'], ref: { low: 11, high: 15 }, systems: ['liver'] },
  { key: 'aptt', name: '活化部分凝血活酶时间(APTT)', unit: 's', group: 'liver', decimals: 1, aliases: ['活化部分凝血活酶时间', 'APTT'], ref: { low: 25, high: 37 }, systems: ['liver'] },
  { key: 'liver_stiffness', name: '肝脏硬度(瞬时弹性)', unit: 'kPa', group: 'liver', decimals: 1, aliases: ['肝脏硬度', '肝硬度', '瞬时弹性'], ref: { low: 0, high: 7 }, systems: ['liver'] },
  { key: 'liver_cap', name: '肝脏脂肪含量(CAP)', unit: 'dB/m', group: 'liver', decimals: 0, aliases: ['CAP', '肝脏脂肪', '受控衰减参数'], ref: { low: 0, high: 240 }, systems: ['liver', 'metabolism'] },
  // ---- 肾脏与尿酸 ----
  { key: 'creatinine', name: '肌酐', unit: 'μmol/L', group: 'kidney', decimals: 1, aliases: ['肌酐', '血肌酐', 'CREA', 'Cr', 'CRE'], refBySex: { male: { low: 57, high: 97 }, female: { low: 41, high: 73 } } },
  { key: 'bun', name: '尿素氮', unit: 'mmol/L', group: 'kidney', decimals: 2, aliases: ['尿素氮', '尿素', 'BUN', 'UREA'], ref: { low: 2.9, high: 8.2 } },
  { key: 'uric_acid', name: '尿酸', unit: 'μmol/L', group: 'kidney', decimals: 1, aliases: ['尿酸', '血尿酸', 'UA', 'URIC'], refBySex: { male: { low: 208, high: 428 }, female: { low: 155, high: 357 } }, systems: ['metabolism'] },
  { key: 'cystatin_c', name: '胱抑素C', unit: 'mg/L', group: 'kidney', decimals: 2, aliases: ['胱抑素C', 'CysC', '胱抑素'], ref: { low: 0.51, high: 1.09 } },
  // ---- 血常规 ----
  { key: 'wbc', name: '白细胞计数', unit: '×10⁹/L', group: 'cbc', decimals: 2, aliases: ['白细胞', '白细胞计数', 'WBC'], ref: { low: 3.5, high: 9.5 }, systems: ['immune'] },
  { key: 'neut', name: '中性粒细胞计数', unit: '×10⁹/L', group: 'cbc', decimals: 2, aliases: ['中性粒细胞', '中性粒细胞计数', 'NEUT'], ref: { low: 1.8, high: 6.3 }, systems: ['immune'] },
  { key: 'lymph', name: '淋巴细胞计数', unit: '×10⁹/L', group: 'cbc', decimals: 2, aliases: ['淋巴细胞', '淋巴细胞计数', 'LYMPH'], ref: { low: 1.1, high: 3.2 }, systems: ['immune'] },
  { key: 'nlr', name: '中性粒/淋巴细胞比值(NLR)', unit: '', group: 'cbc', decimals: 2, aliases: ['NLR', '中性粒淋巴细胞比值'], ref: { low: 1, high: 3 }, derived: true, systems: ['immune', 'inflammation'] },
  { key: 'rbc', name: '红细胞计数', unit: '×10¹²/L', group: 'cbc', decimals: 2, aliases: ['红细胞', '红细胞计数', 'RBC'], refBySex: { male: { low: 4.3, high: 5.8 }, female: { low: 3.8, high: 5.1 } } },
  { key: 'hgb', name: '血红蛋白', unit: 'g/L', group: 'cbc', decimals: 0, aliases: ['血红蛋白', 'HGB', 'HB', 'Hb'], refBySex: { male: { low: 130, high: 175 }, female: { low: 115, high: 150 } }, systems: ['metabolism'] },
  { key: 'hct', name: '红细胞压积', unit: '%', group: 'cbc', decimals: 1, aliases: ['红细胞压积', '血细胞比容', 'HCT'], refBySex: { male: { low: 40, high: 50 }, female: { low: 35, high: 45 } } },
  { key: 'plt', name: '血小板计数', unit: '×10⁹/L', group: 'cbc', decimals: 0, aliases: ['血小板', '血小板计数', 'PLT'], ref: { low: 125, high: 350 } },
  { key: 'mcv', name: '平均红细胞体积', unit: 'fL', group: 'cbc', decimals: 1, aliases: ['平均红细胞体积', 'MCV'], ref: { low: 82, high: 100 } },
  // ---- 尿常规 ----
  { key: 'urine_protein', name: '尿蛋白', unit: '', group: 'urine', kind: 'text', aliases: ['尿蛋白', 'PRO(尿)', '蛋白质(尿)'], normalValues: ['阴性', '-', 'neg', 'negative', '正常', '—', '未检出'] },
  { key: 'urine_glucose', name: '尿糖', unit: '', group: 'urine', kind: 'text', aliases: ['尿糖', '尿葡萄糖', 'GLU(尿)'], normalValues: ['阴性', '-', 'neg', 'negative', '正常', '—', '未检出'] },
  { key: 'urine_blood', name: '尿潜血', unit: '', group: 'urine', kind: 'text', aliases: ['尿潜血', '隐血', 'BLD', 'OB'], normalValues: ['阴性', '-', 'neg', 'negative', '正常', '—', '未检出'] },
  // ---- 甲状腺 ----
  { key: 'tsh', name: '促甲状腺激素(TSH)', unit: 'mIU/L', group: 'thyroid', decimals: 2, aliases: ['促甲状腺激素', 'TSH'], ref: { low: 0.27, high: 4.2 }, systems: ['metabolism'] },
  { key: 'ft3', name: '游离三碘甲状腺原氨酸(FT3)', unit: 'pmol/L', group: 'thyroid', decimals: 2, aliases: ['游离T3', 'FT3'], ref: { low: 3.1, high: 6.8 }, systems: ['metabolism'] },
  { key: 'ft4', name: '游离甲状腺素(FT4)', unit: 'pmol/L', group: 'thyroid', decimals: 2, aliases: ['游离T4', 'FT4'], ref: { low: 12, high: 22 }, systems: ['metabolism'] },
  // ---- 肿瘤标志物 ----
  { key: 'cea', name: '癌胚抗原(CEA)', unit: 'ng/mL', group: 'tumor', decimals: 2, aliases: ['癌胚抗原', 'CEA'], ref: { low: 0, high: 5 } },
  { key: 'afp', name: '甲胎蛋白(AFP)', unit: 'ng/mL', group: 'tumor', decimals: 2, aliases: ['甲胎蛋白', 'AFP'], ref: { low: 0, high: 7 } },
  // ---- 心血管 ----
  { key: 'pwv', name: '脉搏波传导速度(PWV)', unit: 'm/s', group: 'cardio', decimals: 1, aliases: ['脉搏波传导速度', 'PWV', 'baPWV'], ref: { low: 0, high: 12 }, systems: ['cardiovascular'] },
  { key: 'cimt', name: '颈动脉内膜中层厚度(IMT)', unit: 'mm', group: 'cardio', decimals: 2, aliases: ['颈动脉内膜中层厚度', '内膜中层厚度', 'IMT', 'CIMT'], ref: { low: 0, high: 1.0 }, systems: ['cardiovascular'] },
  { key: 'nt_probnp', name: 'NT-proBNP', unit: 'pg/mL', group: 'cardio', decimals: 0, aliases: ['NT-proBNP', '脑钠肽', 'BNP'], ref: { low: 0, high: 125 }, systems: ['cardiovascular'] },
  { key: 'troponin', name: '高敏肌钙蛋白', unit: 'ng/L', group: 'cardio', decimals: 1, aliases: ['肌钙蛋白', '高敏肌钙蛋白', 'Troponin', 'hs-cTnI', 'hs-cTnT'], ref: { low: 0, high: 14 }, systems: ['cardiovascular'] },
  { key: 'hrv', name: '心率变异性(HRV)', unit: 'ms', group: 'cardio', decimals: 0, aliases: ['心率变异性', 'HRV', 'SDNN'], ref: { low: 50, high: 200 }, systems: ['cardiovascular', 'neuro'] },
  // ---- 炎症 ----
  { key: 'hs_crp', name: '超敏C反应蛋白(hs-CRP)', unit: 'mg/L', group: 'inflammation', decimals: 2, aliases: ['超敏C反应蛋白', '超敏CRP', 'hs-CRP', 'hsCRP', 'CRP'], ref: { low: 0, high: 2 }, systems: ['inflammation', 'cardiovascular'] },
  { key: 'il_6', name: '白细胞介素-6(IL-6)', unit: 'pg/mL', group: 'inflammation', decimals: 2, aliases: ['白细胞介素6', '白细胞介素-6', 'IL-6', 'IL6'], ref: { low: 0, high: 7 }, systems: ['inflammation'] },
  { key: 'tnf_a', name: '肿瘤坏死因子α(TNF-α)', unit: 'pg/mL', group: 'inflammation', decimals: 2, aliases: ['肿瘤坏死因子', 'TNF-α', 'TNFa', 'TNF'], ref: { low: 0, high: 8.1 }, systems: ['inflammation'] },
  { key: 'fibrinogen', name: '纤维蛋白原', unit: 'g/L', group: 'inflammation', decimals: 2, aliases: ['纤维蛋白原', 'FIB', 'Fibrinogen'], ref: { low: 2, high: 4 }, systems: ['inflammation'] },
  { key: 'gdf15', name: 'GDF15', unit: 'pg/mL', group: 'inflammation', decimals: 1, aliases: ['GDF15', '生长分化因子15'], systems: ['inflammation', 'autophagy'] },
  // ---- 免疫 ----
  { key: 'cd4_cd8', name: 'CD4/CD8 比值', unit: '', group: 'immune', decimals: 2, aliases: ['CD4/CD8', 'CD4CD8', 'T细胞亚群', '淋巴细胞亚群'], ref: { low: 1.5, high: 2.0 }, systems: ['immune'] },
  { key: 'naive_t', name: '幼稚/记忆T细胞比例', unit: '', group: 'immune', kind: 'text', aliases: ['幼稚T细胞', '记忆T细胞', 'naive T'], systems: ['immune'] },
  { key: 'nk_activity', name: '自然杀伤细胞活性', unit: '', group: 'immune', kind: 'text', aliases: ['NK细胞活性', '自然杀伤细胞'], systems: ['immune'] },
  { key: 'cmv_igg', name: 'CMV-IgG', unit: '', group: 'immune', kind: 'text', aliases: ['CMV-IgG', '巨细胞病毒抗体', 'CMV抗体'], normalValues: ['阴性', '-', 'neg', 'negative', '正常', '未检出'], systems: ['immune'] },
  { key: 'ebv', name: 'EBV抗体', unit: '', group: 'immune', kind: 'text', aliases: ['EBV', 'EB病毒抗体'], systems: ['immune'] },
  // ---- 肌肉与体能 ----
  { key: 'asmi', name: '四肢骨骼肌质量指数', unit: 'kg/m²', group: 'muscle', decimals: 2, aliases: ['四肢骨骼肌质量', '骨骼肌质量指数', 'ASMI', 'DEXA', '去脂体重'], refBySex: { male: { low: 7.0, high: 20 }, female: { low: 5.7, high: 20 } }, systems: ['muscle'] },
  { key: 'grip_kg', name: '握力', unit: 'kg', group: 'muscle', decimals: 1, aliases: ['握力', 'grip'], refBySex: { male: { low: 28, high: 80 }, female: { low: 18, high: 60 } }, systems: ['muscle'] },
  { key: 'gait_speed', name: '步速（4米步行）', unit: 'm/s', group: 'muscle', decimals: 2, aliases: ['步速', '步行速度', 'gait speed'], ref: { low: 1.0, high: 3 }, systems: ['muscle'] },
  { key: 'sit_to_stand_5', name: '五次坐站测试', unit: 's', group: 'muscle', decimals: 1, aliases: ['五次坐站', '坐站测试', 'sit to stand'], ref: { low: 0, high: 12 }, systems: ['muscle'] },
  { key: 'vo2max', name: '最大摄氧量(VO₂max)', unit: 'ml/kg/min', group: 'muscle', decimals: 1, aliases: ['最大摄氧量', 'VO2max', 'VO₂max'], systems: ['mitochondria', 'muscle'] },
  // ---- 神经与心理 ----
  { key: 'moca', name: '认知评估(MoCA)', unit: '分', group: 'neuro', decimals: 0, aliases: ['MoCA', '蒙特利尔认知评估', '认知评估'], ref: { low: 26, high: 30 }, systems: ['neuro'] },
  { key: 'mmse', name: '简易精神状态检查(MMSE)', unit: '分', group: 'neuro', decimals: 0, aliases: ['MMSE', '简易精神状态检查'], ref: { low: 27, high: 30 }, systems: ['neuro'] },
  { key: 'bdnf', name: '脑源性神经营养因子(BDNF)', unit: 'ng/mL', group: 'neuro', decimals: 2, aliases: ['BDNF', '脑源性神经营养因子'], systems: ['neuro'] },
  { key: 'b12', name: '维生素B12', unit: 'pg/mL', group: 'neuro', decimals: 0, aliases: ['维生素B12', 'B12', 'VitB12'], ref: { low: 200, high: 900 }, systems: ['neuro'] },
  { key: 'folate', name: '叶酸', unit: 'ng/mL', group: 'neuro', decimals: 2, aliases: ['叶酸', 'folate'], ref: { low: 4, high: 20 }, systems: ['neuro'] },
  { key: 'vitamin_d', name: '维生素D(25-OH)', unit: 'ng/mL', group: 'neuro', decimals: 1, aliases: ['维生素D', '25-OH维生素D', '25(OH)D', 'VitD'], ref: { low: 30, high: 100 }, systems: ['neuro', 'immune', 'muscle'] },
  { key: 'nfl', name: '神经丝轻链(NFL)', unit: 'pg/mL', group: 'neuro', decimals: 2, aliases: ['神经丝轻链', 'NFL', 'NfL'], systems: ['neuro'] },
  { key: 'phq9', name: '抑郁量表(PHQ-9)', unit: '分', group: 'neuro', decimals: 0, aliases: ['PHQ-9', 'PHQ9', '抑郁量表'], ref: { low: 0, high: 4 }, systems: ['neuro'] },
  { key: 'gad7', name: '焦虑量表(GAD-7)', unit: '分', group: 'neuro', decimals: 0, aliases: ['GAD-7', 'GAD7', '焦虑量表'], ref: { low: 0, high: 4 }, systems: ['neuro'] },
  { key: 'pss', name: '压力感知量表(PSS)', unit: '分', group: 'neuro', decimals: 0, aliases: ['PSS', '压力感知量表'], systems: ['neuro'] },
  // ---- 长寿专项（底层基础设施） ----
  { key: 'nad', name: 'NAD+ 水平', unit: '', group: 'longevity', decimals: 2, aliases: ['NAD+', 'NAD'], systems: ['mitochondria'] },
  { key: 'lactate', name: '乳酸', unit: 'mmol/L', group: 'longevity', decimals: 2, aliases: ['乳酸', 'lactate'], ref: { low: 0.5, high: 2.2 }, systems: ['mitochondria'] },
  { key: 'pyruvate', name: '丙酮酸', unit: 'mmol/L', group: 'longevity', decimals: 2, aliases: ['丙酮酸', 'pyruvate'], systems: ['mitochondria'] },
  { key: 'coq10', name: '辅酶Q10', unit: 'μg/mL', group: 'longevity', decimals: 2, aliases: ['辅酶Q10', 'CoQ10', '辅酶Q'], systems: ['mitochondria'] },
  { key: 'mt_dna_cn', name: '线粒体DNA拷贝数', unit: '', group: 'longevity', decimals: 1, aliases: ['线粒体DNA拷贝数', 'mtDNA'], systems: ['mitochondria'] },
  { key: 'lc3', name: 'LC3-II/I 比值', unit: '', group: 'longevity', decimals: 2, aliases: ['LC3-II/I', 'LC3'], systems: ['autophagy'] },
  { key: 'p62', name: 'p62 水平', unit: '', group: 'longevity', decimals: 2, aliases: ['p62'], systems: ['autophagy'] },
  { key: 'epigenetic_age', name: '表观遗传时钟（生物年龄）', unit: '', group: 'longevity', kind: 'text', aliases: ['表观遗传时钟', '生物年龄', 'Horvath', 'PhenoAge'], systems: ['epigenetics'] },
  { key: 'telomere', name: '端粒长度', unit: '', group: 'longevity', kind: 'text', aliases: ['端粒长度', '端粒', 'telomere'], systems: ['epigenetics'] },
  { key: 'g_h2ax', name: 'γ-H2AX', unit: '', group: 'longevity', decimals: 2, aliases: ['γ-H2AX', 'H2AX'], systems: ['epigenetics'] },
  { key: 'oh8dg', name: '8-OHdG（DNA氧化损伤）', unit: '', group: 'longevity', decimals: 2, aliases: ['8-OHdG', '8OHdG'], systems: ['epigenetics'] },
  { key: 'zonulin', name: '连蛋白(zonulin)', unit: 'ng/mL', group: 'longevity', decimals: 2, aliases: ['zonulin', '连蛋白'], systems: ['gut'] },
  { key: 'lps', name: '脂多糖(LPS)', unit: 'EU/mL', group: 'longevity', decimals: 2, aliases: ['LPS', '脂多糖', '内毒素'], systems: ['gut'] },
  { key: 'calprotectin', name: '粪便钙卫蛋白', unit: 'μg/g', group: 'longevity', decimals: 1, aliases: ['钙卫蛋白', 'calprotectin'], ref: { low: 0, high: 50 }, systems: ['gut'] },
  { key: 'gut_microbiome', name: '肠道菌群检测', unit: '', group: 'longevity', kind: 'text', aliases: ['肠道菌群', '宏基因组', '菌群多样性'], systems: ['gut'] },
  { key: 'scfa', name: '粪便短链脂肪酸', unit: '', group: 'longevity', decimals: 2, aliases: ['短链脂肪酸', 'SCFA'], systems: ['gut'] },
  // ---- 日常记录 ----
  { key: 'sleep_hours', name: '睡眠时长', unit: '小时', group: 'daily', daily: true, decimals: 1, aliases: ['睡眠', '睡眠时长', 'sleep'], ref: { low: 7, high: 9 }, systems: ['neuro'] },
  { key: 'sleep_efficiency', name: '睡眠效率', unit: '%', group: 'daily', daily: true, decimals: 0, aliases: ['睡眠效率', '深睡', 'deep sleep'], ref: { low: 85, high: 100 }, systems: ['neuro'] },
  { key: 'exercise_min', name: '运动时长', unit: '分钟', group: 'daily', daily: true, decimals: 0, aliases: ['运动', '运动时长', 'exercise'], systems: ['muscle', 'mitochondria'] },
  { key: 'water_ml', name: '饮水量', unit: 'ml', group: 'daily', daily: true, decimals: 0, aliases: ['饮水', '饮水量', '喝水', 'water'] },
  { key: 'steps', name: '步数', unit: '步', group: 'daily', daily: true, decimals: 0, aliases: ['步数', 'steps'], systems: ['muscle'] },
  { key: 'resting_hr', name: '静息心率（可穿戴）', unit: '次/分', group: 'daily', daily: true, decimals: 0, aliases: ['静息心率', 'resting heart rate'], ref: { low: 50, high: 70 }, systems: ['cardiovascular', 'mitochondria'] },
]

/** @type {Map<string, CatalogEntry>} */
export const BY_KEY = new Map(CATALOG.map((entry) => [entry.key, entry]))

/** Normalize a report label for matching. */
export function normalizeLabel(label) {
  return String(label ?? '')
    .toLowerCase()
    .replace(/[\s()（）[\]【】:：·,，.。/\\_\-—+]/g, '')
}

const ALIAS_INDEX = new Map()
for (const entry of CATALOG) {
  for (const alias of [entry.key, entry.name, ...entry.aliases]) {
    const normalized = normalizeLabel(alias)
    if (normalized.length === 0) continue
    if (!ALIAS_INDEX.has(normalized)) ALIAS_INDEX.set(normalized, entry)
  }
}

/**
 * Resolve a report label to a catalog entry.
 * @param {string} label
 * @returns {CatalogEntry | undefined}
 */
export function matchIndicator(label) {
  const normalized = normalizeLabel(label)
  if (normalized.length === 0) return undefined
  const exact = ALIAS_INDEX.get(normalized)
  if (exact !== undefined) return exact
  let best
  let bestLength = 0
  for (const [alias, entry] of ALIAS_INDEX) {
    if (alias.length < 2) continue
    if (normalized.includes(alias) && alias.length > bestLength) {
      best = entry
      bestLength = alias.length
    }
  }
  return best
}

/** Parse a numeric value out of "5.6", "5.6 mmol/L", "＜0.5", "阴性". */
export function parseNumeric(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const text = String(raw ?? '').trim()
  if (text.length === 0) return undefined
  const match = text.replace(/[，,]/g, '.').match(/[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)
  if (match === null) return undefined
  const value = Number(match[0])
  return Number.isFinite(value) ? value : undefined
}

/** Resolve the reference range for one entry and sex. */
export function rangeFor(entry, sex) {
  if (entry.refBySex !== undefined) {
    const bySex = sex === 'female' ? entry.refBySex.female : entry.refBySex.male
    if (bySex !== undefined) return bySex
  }
  return entry.ref ?? {}
}

/**
 * Build a canonical indicator value from a report row.
 * @param {string} label
 * @param {unknown} rawValue
 * @param {string} [unit]
 * @param {number|null} [refLow]
 * @param {number|null} [refHigh]
 * @param {'male'|'female'|undefined} [sex]
 */
export function buildIndicator(label, rawValue, unit, refLow, refHigh, sex) {
  const entry = matchIndicator(label)
  const text = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim()
  const kind = entry?.kind ?? (parseNumeric(text) === undefined ? 'text' : 'number')
  let value = text
  if (kind === 'number') {
    const parsed = parseNumeric(text)
    value = parsed === undefined ? text : parsed
  }
  const name = (entry?.name ?? String(label ?? '').trim()) || '未命名指标'
  const resolvedUnit = unit && String(unit).trim().length > 0 ? String(unit).trim() : entry?.unit ?? ''
  const range = entry === undefined ? {} : rangeFor(entry, sex)
  const low = refLow === null || refLow === undefined ? range.low : Number(refLow)
  const high = refHigh === null || refHigh === undefined ? range.high : Number(refHigh)
  const indicator = {
    key: entry?.key ?? `custom:${String(label ?? '').trim()}`,
    name,
    value,
    unit: resolvedUnit,
    group: entry?.group ?? 'longevity',
    ...(entry?.systems === undefined ? {} : { systems: [...entry.systems] }),
    ...(Number.isFinite(low) ? { refLow: low } : {}),
    ...(Number.isFinite(high) ? { refHigh: high } : {}),
  }
  indicator.status = statusOf(indicator, entry, sex)
  return indicator
}

/**
 * Compare one indicator against its reference range.
 * @returns {'normal'|'high'|'low'|'abnormal'|'unknown'}
 */
export function statusOf(indicator, entry, sex) {
  if (typeof indicator.value !== 'number') {
    const text = String(indicator.value ?? '').trim().toLowerCase()
    if (text.length === 0) return 'unknown'
    const normalValues = entry?.normalValues ?? ['阴性', '-', 'neg', 'negative', '正常', '—', '未检出']
    if (normalValues.some((normal) => text === normal.toLowerCase() || text.includes(normal.toLowerCase()))) return 'normal'
    return 'abnormal'
  }
  const range = indicator.refLow === undefined && indicator.refHigh === undefined
    ? rangeFor(entry ?? { ref: {} }, sex)
    : { low: indicator.refLow, high: indicator.refHigh }
  if (range.high !== undefined && indicator.value > range.high) return 'high'
  if (range.low !== undefined && indicator.value < range.low) return 'low'
  return 'normal'
}

/** Format one indicator value for display. */
export function formatValue(indicator) {
  if (typeof indicator.value !== 'number') return String(indicator.value ?? '')
  const entry = BY_KEY.get(indicator.key)
  const decimals = entry?.decimals ?? (Number.isInteger(indicator.value) ? 0 : 2)
  return indicator.value.toFixed(decimals)
}

/** Format a reference range. */
export function formatRange(indicator) {
  const low = indicator.refLow
  const high = indicator.refHigh
  if (low !== undefined && high !== undefined) return `${low}–${high}`
  if (high !== undefined) return `≤${high}`
  if (low !== undefined) return `≥${low}`
  return ''
}

/** Read one numeric indicator value from an indicator list. */
export function numericValue(indicators, key) {
  const indicator = indicators.find((entry) => entry.key === key)
  return typeof indicator?.value === 'number' ? indicator.value : undefined
}

/**
 * Add locally computable metrics (BMI, waist/height, HOMA-IR, pulse pressure,
 * NLR) from the raw indicators. Existing values are never overwritten.
 * @param {object[]} indicators
 * @param {{sex?: string}} person
 * @returns {object[]} the same array, with derived rows appended
 */
export function deriveIndicators(indicators, person) {
  const sex = person?.sex === 'female' ? 'female' : person?.sex === 'male' ? 'male' : undefined
  const has = (key) => indicators.some((entry) => entry.key === key)
  const add = (key, value) => {
    if (has(key) || !Number.isFinite(value)) return
    const entry = BY_KEY.get(key)
    if (entry === undefined) return
    const range = rangeFor(entry, sex)
    const indicator = {
      key, name: `${entry.name}（计算）`, value: Number(value.toFixed(entry.decimals ?? 2)), unit: entry.unit, group: entry.group,
      systems: entry.systems,
      ...(range.low === undefined ? {} : { refLow: range.low }),
      ...(range.high === undefined ? {} : { refHigh: range.high }),
    }
    indicator.status = statusOf(indicator, entry, sex)
    indicators.push(indicator)
  }
  const height = numericValue(indicators, 'height_cm')
  const weight = numericValue(indicators, 'weight_kg')
  if (height !== undefined && weight !== undefined && height > 50) add('bmi', weight / ((height / 100) ** 2))
  const waist = numericValue(indicators, 'waist_cm')
  if (height !== undefined && waist !== undefined && height > 50) add('waist_height_ratio', waist / height)
  const glucose = numericValue(indicators, 'fasting_glucose')
  const insulin = numericValue(indicators, 'insulin')
  if (glucose !== undefined && insulin !== undefined) add('homa_ir', (glucose * insulin) / 22.5)
  const sbp = numericValue(indicators, 'sbp')
  const dbp = numericValue(indicators, 'dbp')
  if (sbp !== undefined && dbp !== undefined) add('pulse_pressure', sbp - dbp)
  const neut = numericValue(indicators, 'neut')
  const lymph = numericValue(indicators, 'lymph')
  if (neut !== undefined && lymph !== undefined && lymph > 0) add('nlr', neut / lymph)
  return indicators
}

/**
 * Indicators outside their reference range, most severe first.
 * @param {object[]} indicators
 */
export function abnormalOf(indicators) {
  return (Array.isArray(indicators) ? indicators : []).filter((indicator) => indicator.status === 'high' || indicator.status === 'low' || indicator.status === 'abnormal')
}

/** Longevity system keys touched by an indicator list. */
export function systemsOf(indicators) {
  const keys = new Set()
  for (const indicator of Array.isArray(indicators) ? indicators : []) {
    for (const system of indicator.systems ?? []) keys.add(system)
  }
  return [...keys]
}

/** Compact one-line description used by prompts and tool output. */
export function describeIndicators(indicators) {
  const rows = []
  for (const indicator of Array.isArray(indicators) ? indicators : []) {
    const range = formatRange(indicator)
    const status = indicator.status === 'high' ? '偏高' : indicator.status === 'low' ? '偏低' : indicator.status === 'abnormal' ? '异常' : indicator.status === 'normal' ? '正常' : ''
    rows.push(`${indicator.name} ${formatValue(indicator)}${indicator.unit ? ` ${indicator.unit}` : ''}${range ? `（参考 ${range}）` : ''}${status ? ` → ${status}` : ''}`)
  }
  return rows.join('；')
}

/**
 * Render a compact trend series for one key across records (oldest first).
 * @param {object[]} records
 * @param {string} key
 * @returns {{date: string, value: number}[]}
 */
export function seriesOf(records, key) {
  const series = []
  for (const record of Array.isArray(records) ? records : []) {
    const indicator = (record.indicators ?? []).find((entry) => entry.key === key)
    if (indicator !== undefined && typeof indicator.value === 'number' && typeof record.date === 'string') series.push({ date: record.date, value: indicator.value })
  }
  series.sort((left, right) => left.date.localeCompare(right.date))
  return series
}
