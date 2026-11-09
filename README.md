# dsh-plugin-health-manager

在 DeepSeek Harness 里管理多人健康的轻量本地插件：

- **每人一个文件夹，一份 `health.json`**：保存基本资料、全部健康记录和历次生成的风险与建议。
- **上传体检报告**：PDF、照片/截图、文本文件或直接粘贴文字；由当前多模态模型识别成结构化指标，**先给你确认/修改，确认后才写入健康 JSON**。
- **每次更新后推送一次风险与建议**：所有建议都基于内置的《长寿管理》框架（12 个身体系统 + 三级监测体系），输出系统评估、健康风险、饮食、健身和补充监测建议。
- **聊天里也能用**：注册了一组 `health_*` 工具，可以直接让我帮你记录、查看趋势、导入并确认体检报告。

> 建议仅供健康管理参考，不能替代医生诊断。

## 数据存放

默认目录：`%USERPROFILE%\.dsh\health-manager`（可在插件配置里改 `dataDir`）。

```
<dataDir>/
└── p_xxxxxxxxxx/            ← 每位成员一个文件夹
    ├── health.json          ← 唯一数据源：person + records + advices
    └── reports/             ← 归档的原始体检报告（PDF/图片）
```

`health.json` 里的每条记录包含日期、体检/日常类型、指标（含参考范围与偏高/偏低状态）、异常项数量、涉及的长寿系统；每次保存后在 `advices` 里追加一条该次生成的风险与建议。

## 安装

```sh
# 从 GitHub 安装（推荐，固定提交时可用 github:yanjie098/dsh-plugin-health-manager#<sha>）
dsh plugin --profile web add github:yanjie098/dsh-plugin-health-manager
dsh web

# 或者从本地目录安装
dsh plugin --profile web add <本目录的绝对路径>
dsh web
```

也可以在 Web UI 的插件管理面板里安装本地目录。安装后在侧边栏出现「健康管理」入口。

卸载：

```sh
dsh plugin --profile web remove dsh-plugin-health-manager
```

## 配置

在 profile 的 `cordis.patch.yml` 覆盖 `health-manager` 这一行的 `config`：

```yaml
- id: health-manager
  config:
    dataDir: 'D:\health-data'   # 健康数据根目录；留空 = %USERPROFILE%\.dsh\health-manager
    provider: ''                # 留空跟随 Harness 当前默认模型
    model: ''
    requestTimeoutMs: 180000    # 单次模型调用超时
    maxUploadBytes: 15728640    # 上传文件大小上限
```

## 识别与生成流程

1. **上传报告** → PDF 用本机 Poppler（`pdftoppm`/`pdftocairo`，已随 MiKTeX 安装；没有时可用 Ghostscript）按页转成图片；照片在浏览器里压缩；然后 **图片直接交给多模态模型**（不做本地 OCR/文本解析）。
2. 模型返回结构化指标 → 面板展示**可编辑的确认表**（日期、机构/备注、小结、指标与参考范围都可改、可删、可加）。
3. 点「确认保存并生成建议」→ 写入 `health.json` → 基于《长寿管理》框架生成风险与建议 → 同一个请求返回并展示（即“推送”）。
4. 日常数据也一样：保存 → 写入 JSON → 推送一次该更新的建议。

> PDF 渲染依赖本机有 `pdftoppm`/`pdftocairo` 或 Ghostscript；如果都没有，PDF 上传会提示改用截图或粘贴文字。
> 面板代码更新后，刷新一次 Web 页面即可加载最新客户端代码。

## 长寿管理框架

`host/longevity.js` 内置了框架内容：底层基础设施（线粒体、自噬、表观遗传、肠道微生态）、中层核心功能（代谢、炎症与 SASP、脂蛋白）、高层功能表现（心血管、免疫、肝脏与蛋白稳态、肌肉、神经心理），以及三级监测体系与进阶指标。体检指标目录 `host/indicators.js` 同时覆盖常规体检项和框架点名的专项指标（HOMA-IR、ApoB、Lp(a)、hs-CRP、PWV、握力、步速、MoCA、PHQ-9 等），并能自动计算 BMI、腰围/身高比、HOMA-IR、脉压差、NLR。

## 聊天工具

| 工具 | 用途 |
|---|---|
| `health_list_people` | 列出成员 |
| `health_add_person` | 新增成员 |
| `health_get_person` | 档案 + 最近记录 + 最新建议 |
| `health_add_daily_record` | 记录日常数据并推送建议 |
| `health_import_report` | 把报告文字识别成指标草稿（待确认） |
| `health_confirm_report` | 保存已确认的体检记录并推送建议 |
| `health_get_history` | 历史与趋势 |
| `health_get_advice` | 查看最新/指定建议 |
| `health_generate_advice` | 重新生成建议 |

## 开发

纯 JavaScript，无需构建：Host 入口 `index.js`，Client 模块 `client.js`，Host 逻辑在 `host/`。改动后重启 `dsh web` 或让插件重新加载即可。

自检（无需浏览器）：

```sh
node test/selftest.mjs       # Host：指标计算、健康 JSON 读写、建议解析
node test/render-check.mjs   # Client：用桩 React 渲染全部面板组件
```
