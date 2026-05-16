# PRD: WebAccess 浏览器研究执行器接入

## 状态
- 来源：ralplan 设计
- 目标：设计并分阶段接入 WebAccess，使深度研究可通过浏览器只读抓取网页内容，并为后续 agentic 网页操作预留边界。
- 前端要求：所有用户可见文案使用简体中文。

## 背景
当前 llm_wiki 的深度研究主要通过 `src/lib/web-search.ts` 调用 Tavily / SerpApi 获取搜索结果，再在 `src/lib/deep-research.ts` 中基于 snippets 综合。该方式不适合动态网页、需要滚动加载的网页、搜索 API 摘要不足的网页。

WebAccess 的价值不是替代 Tavily/SerpApi，而是作为浏览器证据采集层：打开网页、滚动、提取正文、保存为可审计 source，再交给现有 ingest/LLM 流程。

## 决策
采用独立 WebAccess 层：

```text
src/lib/web-access/contracts.ts
src/lib/web-access/policy.ts
src/lib/web-access/runner.ts
src/lib/web-access/extract.ts
src/lib/web-access/artifacts.ts
```

不把 WebAccess 放入 `SearchProvider`，不作为 `webSearch()` 的第三个 provider。

## 第一性目标
把网页变成可追溯 Markdown source：

```text
Tavily / SerpApi 发现 URL
  ↓
WebAccess 打开、滚动、提取正文
  ↓
保存 raw/sources/web/<runId>/<slug>.md
  ↓
autoIngest
  ↓
生成 wiki/sources 和研究结果
```

## v1 能力边界
v1 只允许只读操作：

- open：打开 URL
- extract：提取标题、正文、链接
- scroll：滚动加载
- close：关闭 tab

v1 禁止：

- click
- browser-native search
- login context
- submit / upload / download / purchase / delete / send
- screenshot
- clickAt / setFiles

点击、站内搜索、登录态页面留到后续阶段。

## 配置模型
新增独立 WebAccess 配置，不混入 SearchApiConfig：

```ts
interface WebAccessConfig {
  enabled: boolean
  endpoint: string
  requirePerTaskConsent: boolean
  allowReadOnlyBrowser: boolean
  allowClick: boolean
  allowLoginContext: boolean
  maxPagesPerRun: number
  maxScrollsPerPage: number
  maxOperationsPerRun: number
  maxPageTextChars: number
  timeoutMs: number
  allowedDomains: string[]
  blockedDomains: string[]
  saveSourceMarkdown: boolean
}
```

默认值：

```ts
enabled: false
endpoint: "http://localhost:3456"
requirePerTaskConsent: true
allowReadOnlyBrowser: false
allowClick: false
allowLoginContext: false
maxPagesPerRun: 5
maxScrollsPerPage: 3
maxOperationsPerRun: 20
maxPageTextChars: 30000
timeoutMs: 30000
allowedDomains: []
blockedDomains: []
saveSourceMarkdown: true
```

## URL 安全策略
默认仅允许 `http:` / `https:`。

默认阻断：

- localhost / 127.0.0.1 / ::1 / 0.0.0.0
- 10.0.0.0/8
- 172.16.0.0/12
- 192.168.0.0/16
- 169.254.0.0/16
- 169.254.169.254
- metadata.google.internal
- file: / data: / javascript: / chrome: / edge: / about:
- malformed URL

策略优先级：

```text
blockedDomains > allowedDomains > default policy
```

检查点：

1. 搜索结果 URL
2. 初始打开 URL
3. 重定向后的 final URL
4. 页面内提取链接
5. 保存 artifact 前 URL

## 持久化产物
每次运行创建 runId：

```text
web-YYYYMMDD-HHMMSS-xxxx
```

保存：

```text
.llm-wiki/web-access/runs/<runId>/trace.json
raw/sources/web/<runId>/<slug>.md
```

成功网页 source frontmatter 必须包含：

```yaml
type: source
origin: web-access
url: ...
final_url: ...
title: ...
fetched_at: ...
run_id: ...
evidence_id: B1
content_hash: ...
sources:
  - ...
tags:
  - web-access
  - deep-research
```

不可引用未成功写入 artifact 的网页。失败/阻断页面只进入 trace，不进入 citation。

## Citation Gate
最终研究结果只能引用：

- `S*`：Tavily/SerpApi 搜索来源
- `B*`：WebAccess 成功保存的浏览器来源

`B*` 必须满足：

- 有 URL
- 有 final URL
- 有 title
- 有 fetched_at
- 有 content_hash
- 有 `raw/sources/web/<runId>/<slug>.md`
- 未被 URL policy 阻断
- artifact 写入成功

## 前端简体中文 UI
在设置页新增独立区域：

标题：`浏览器访问（实验）`

描述：`允许深度研究通过本机浏览器代理打开网页、滚动并提取可引用内容。默认关闭。`

字段：

- 启用浏览器访问
- 代理地址
- 检查连接
- 每次研究前请求确认
- 允许只读浏览器访问
- 允许点击页面元素
- 允许访问已登录页面
- 每次最多打开网页数
- 每页最多滚动次数
- 每次最多操作步数
- 单页最多提取字符数
- 允许的域名
- 禁止的域名
- 保存网页来源 Markdown

状态：

- 未启用
- 连接正常
- 连接失败
- 需要启动浏览器代理
- 代理地址只允许 localhost 或 127.0.0.1

风险提示：

`浏览器访问可能读取当前浏览器中的网页内容。默认不会点击、提交表单、上传文件或访问登录态页面。`

## 分阶段实施

### Phase 1：配置 + contracts + policy + health check
- 新增 WebAccessConfig
- 新增 contracts/policy/runner 基础结构
- 设置页新增简体中文配置区
- health check `http://localhost:3456/health`
- 不改变 Tavily/SerpApi 行为

### Phase 2：只读浏览器抓取
- 接 `/new` `/eval` `/scroll` `/close`
- 提取 title/body.innerText/links/finalUrl
- 写 trace.json
- 写 raw/sources/web Markdown
- 不接 click/search/login

### Phase 3：接入 deep research
- 搜索 URL 后进行 WebAccess 抓取
- source 写入成功后才进入 synthesis
- WebAccess 关闭或失败时降级旧流程
- 成功时研究结果可引用 B1/B2

### Phase 4：有限点击
- 允许“阅读全文/展开/更多/下一页/加载更多”等低风险点击
- 禁止提交/购买/删除/登录/发送/上传/下载/支付
- 每次 click 记录 before/after URL/title/text hash

### Phase 5：agentic browser loop
- observe → plan action → execute → observe → save → stop
- 强预算：最多 30 步、10 页、2 层深挖、5 分钟

## ADR

Decision: 建立独立 WebAccess 层，作为 deep research 的浏览器证据采集与 source 生成能力。

Rejected:
- WebAccess as SearchProvider：边界混乱，不利于安全和审计。
- 第一版直接做点击/登录态：风险过高。

Consequences:
- 第一版保守但安全。
- 后续可渐进支持点击、站内搜索、登录态、截图。
- 所有前端文案必须简体中文。
