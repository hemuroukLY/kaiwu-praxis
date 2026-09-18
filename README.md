# kaiwu-praxis · 开物 Praxis

一个 DeepSeek Harness（DSH）员工端插件：把「数字员工」带进 DSH。

安装并启动 web 后，侧边栏会出现「数字员工广场」入口；点进去选择一位员工，即以它专属的工具与 SOP 开始新会话。插件同时注册 4 个本地确定性文件工具（A 层），并提供「员工设置」维护每位员工的资料与能力。

## 7 位数字员工

| 员工 | preset id | 定位 | 技能 |
| --- | --- | --- | --- |
| 水印工具 | `kaiwu-watermark` | 批量给 PDF / 图片加水印，本地零联网（资料防泄密、客户方案外发） | `kaiwu-watermark` |
| 资料管家 | `kaiwu-docbutler` | 政企投标资料整理：自动分类资质、到期预警、生成投标资料清单 | `kaiwu-docbutler` |
| 内容撰稿员 | `kaiwu-content` | 按产品 / 活动 / 受众一键出多版可用营销文案 | `kaiwu-content` |
| 竞品分析员 | `kaiwu-competitor` | 竞品套餐 / 方案盯防：检索并带来源汇总友商动态、做对比表 | `kaiwu-competitor` |
| 情报采集员 | `kaiwu-research` | 区域 / 行业 / 客户公开情报汇总成简报 | `kaiwu-research` |
| 品牌诊断员 | `kaiwu-brand-auditor` | 扫描公开信息，输出带来源与置信度的品牌健康诊断 | `kaiwu-brand-auditor` |
| 数据追踪员 | `kaiwu-data-tracker` | 统一指标口径，生成可复核的台账、趋势分析与汇报材料 | `kaiwu-data-tracker` |
| 运维诊断员 | `kaiwu-aiops` | AIOps：查指标/日志/变更，输出根因与处置建议（不自动执行） | `kaiwu-aiops` |

每位员工一个技能（`presets/<id>/skills/<id>/SKILL.md`），随预设一起分发；会话由该员工的 persona 主动加载并按其 SOP 工作。

## 4 个文件工具（A 层）

- `batch_rename` —— 批量重命名（前缀 / 后缀 / 序号）
- `format_convert` —— 图片格式互转（png / jpg / webp / avif / tiff）
- `watermark` —— PDF / 图片加水印，可选打包 ZIP
- `file_classify` —— 文件自动分类，可选归档

工具全部本地确定性执行，不依赖模型推理，结果可复现。

## 安装

`dsh plugin` 会转发给 pnpm，可从 GitHub 或本地安装：

```bash
# 从 GitHub 安装到某个 profile
dsh plugin --profile <profile> add git+https://github.com/hemuroukLY/kaiwu-praxis.git#v0.5.1

# 本地链接开发
dsh plugin --profile <profile> add link:<本仓库绝对路径>
```

然后启动该 profile 的 web：

```bash
dsh web --profile <profile> --port 3081
```

7 个数字员工预设会在宿主首次加载时自动播种到 `~/.dsh/.agent-presets/`（`preset.yml` / `agent.cordis.yml` / `skills/`）。

## 使用

1. **进入广场**：启动 web 后，点侧边栏的「数字员工广场」。
2. **开始会话**：点任意员工卡片，即选中该预设并开启新会话；未发消息时输入框上方会显示能力卡片，对话开始后缩为输入框上方的小头像，悬停可再次查看。
3. **员工设置**：广场右上角「员工设置」进入；安装 `dsh-better-sidebar` 时入口位于其两个面板按钮左侧，左侧选员工并切换管理模块：
   - **员工档案 / 对话日志**：展示负责人、部门、入职时间、员工简介，以及来自 DSH 会话快照的今日/累计/执行中/已完成统计和近期对话。
   - **定时任务**：维护任务计划、执行周期、指令和启停状态；当前版本保存管理配置，尚未接通后台自动调度。
   - **记忆 / 资料 / SOP**：新增、编辑、删除 Markdown 内容；资料与 SOP 分别自动落盘到员工预设目录的 `knowledge/`、`sop/`。
   - **能力配置**：技能与工具合并管理。技能支持新增、编辑、启停、删除和恢复；工具只能从员工真实声明的能力中启停。变更会物化到员工预设，工具组件调整对新对话完整生效。
   - **企业连接**：内置可展开的使用引导，说明中枢地址、一次性注册码、连接状态和断线恢复排查。
4. 广场卡片与能力卡片上的「资料 / 技能 / SOP」数字来自管理端真实数据。

## 企业管理端

企业管理功能已经拆分为独立插件 `kaiwu-praxis-enterprise`，与本员工端分别安装、分别升级。员工端保留轻量终端代理；在「员工设置 → 企业连接」填写企业中枢地址、一次性注册码和终端名称后，会主动上报资产并拉取配置指令。员工端不开放入站端口；没有安装企业端或没有填写注册码时，不影响独立使用。

终端 UUID 与企业端签发的终端密钥保存在当前 `DSH_HOME/.kaiwu-enterprise/terminal.json`，不会下发给浏览器。配置指令执行前后会向中枢报告状态；已经执行但尚未确认的指令在重试时只补发回执，不会重复修改资料或技能。

也可以在首次启动前通过环境变量预设连接信息：

```bash
KAIWU_ENTERPRISE_HUB_URL=http://<企业管理端内网地址>:3099
KAIWU_ENTERPRISE_ENROLLMENT_CODE=<一次性注册码>
```

> 员工设置数据存在 DSH 的 settings 命名空间 `kaiwu-praxis`（`~/.dsh/settings.yaml`），宿主会 watch 变更并把资料、SOP、技能与工具策略物化到预设目录。能力项记录交付来源、基线版本、当前包版本、本地修订和删除标记，为后续差异升级预留数据。

## 目录结构

```
kaiwu-praxis/
├── package.json          # dsh.bundle.patch + dsh.client + 依赖
├── cordis.patch.yml      # 把 host 插件 kaiwu-praxis 挂进组合
├── lib/
│   ├── index.js          # host 插件：注册 A 层工具 + 播种 presets + 管理端数据层
│   ├── admin.mjs         # 管理端 settings 命名空间 + 技能种子 + 文件物化
│   ├── enterprise-endpoint.mjs # 员工端终端代理：心跳与指令拉取
│   ├── client.js         # 客户端自注册 bundle：广场 + 员工设置 + 会话能力卡片（免构建）
│   ├── files-tools.mjs   # 4 个 A 层文件工具
│   ├── watermark-core.mjs
│   └── classify-core.mjs
└── presets/
    └── kaiwu-{watermark,docbutler,content,competitor,research,brand-auditor,data-tracker}/
        ├── agent.cordis.yml
        ├── preset.yml
        └── skills/<name>/SKILL.md
```

## 说明

- 客户端 `lib/client.js` 是手写的「自注册 bundle」（`window.__ModuleLoader__.load`），**无需打包步骤**，直接作为 `exports["./client"]` 下发。
- 广场是挂在 `shell.overlay` 的整页覆盖层（只覆盖主内容区，保留 DSH 原生侧边栏），由侧边栏注入的「数字员工广场」按钮驱动开合。
- 预设根走用户根 `~/.dsh/.agent-presets/`，由 host 插件幂等播种；管理端只读写这个目录下的 `knowledge/`、`sop/`，不碰其他文件。
- `@deepseek-ai/schemastery` 是可选 peerDependency，由 DSH 宿主提供。

## License

MIT

## 开发交接

项目已进入跨设备通信收尾阶段。接手开发请从 [`docs/handoff/README.md`](./docs/handoff/README.md) 开始；企业管理端为独立插件和独立仓库，不应合并安装或发布。
