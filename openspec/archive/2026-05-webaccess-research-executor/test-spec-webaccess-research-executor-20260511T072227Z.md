# Test Spec: WebAccess 浏览器研究执行器接入

## 测试目标
验证 WebAccess 接入在默认关闭、安全策略、只读浏览器抓取、artifact 持久化、deep research 集成和简体中文 UI 上满足 PRD。

## Phase 1 测试：配置、策略、health check

### 配置默认值
- WebAccess 默认关闭。
- 默认 endpoint 为 `http://localhost:3456`。
- 默认不允许 click。
- 默认不允许 login context。
- 默认 requirePerTaskConsent 为 true。

### 配置持久化
- 设置页保存 endpoint 后可重新加载。
- maxPages/maxScrolls/maxOperations/maxPageTextChars 可保存。
- allowedDomains/blockedDomains 可保存。
- 配置独立于 SearchApiConfig，不影响 Tavily/SerpApi API Key。

### UI 简体中文
断言用户可见文案包含：
- 浏览器访问（实验）
- 启用浏览器访问
- 代理地址
- 检查连接
- 连接正常
- 连接失败
- 需要启动浏览器代理
- 每次最多打开网页数
- 每页最多滚动次数
- 单页最多提取字符数

不得出现未本地化的英文按钮文案，例如：Enable、Check、Connected、Failed。

### health check
- `/health` 成功时显示 `连接正常`。
- `/health` 失败时显示 `连接失败` 或 `需要启动浏览器代理`。
- endpoint 非 localhost/127.0.0.1 时提示额外风险或阻断。

## URL Policy 测试

### 协议阻断
以下 URL 必须阻断：
- `file:///C:/x`
- `data:text/html,abc`
- `javascript:alert(1)`
- `chrome://settings`
- `about:blank`

### 本地/私网阻断
以下 URL 必须阻断：
- `http://localhost:3000`
- `http://127.0.0.1:3456`
- `http://10.0.0.1`
- `http://172.16.0.1`
- `http://192.168.1.1`
- `http://169.254.169.254`
- `http://metadata.google.internal`

### allow/deny 优先级
- blockedDomains 命中时必须阻断，即使 allowedDomains 也命中。
- allowedDomains 非空时，只允许命中的域名。
- malformed URL 必须阻断。

### 重定向检查
- 初始 URL 合法但 finalUrl 跳转到私网地址时必须阻断并关闭 tab。
- finalUrl 被阻断时不得写 source artifact。

## Phase 2 测试：只读 WebAccess runner

### open/extract/scroll/close
mock CDP proxy：
- `/new` 返回 target id。
- `/eval` 返回 title/finalUrl/bodyText/links。
- `/scroll` 被调用不超过 maxScrollsPerPage。
- `/close` 在成功和失败路径都被尝试调用。

### 超时/重试
- `/new` 超时返回 structured error。
- `/eval` 超时返回 structured error。
- 可配置 retry 次数；超过后写 trace，不写 citation。

### 内容预算
- bodyText 超过 maxPageTextChars 时截断。
- trace 记录 truncated=true。
- synthesis 只接收截断后的内容或 evidence。

### 操作预算
- 超过 maxPagesPerRun 后停止打开新页面。
- 超过 maxOperationsPerRun 后停止执行并写 warning。

## Artifact 测试

### 成功写入
成功抓取页面后必须写：

```text
raw/sources/web/<runId>/<slug>.md
.llm-wiki/web-access/runs/<runId>/trace.json
```

source frontmatter 必须包含：
- type: source
- origin: web-access
- url
- final_url
- title
- fetched_at
- run_id
- evidence_id
- content_hash
- sources

### 失败/阻断页面
- 不写 raw/sources/web artifact。
- trace.json 记录 blocked/failed 原因。
- 不产生 B citation。

### trace 脱敏
trace 中不得保存：
- cookie
- localStorage
- sessionStorage
- authorization header
- password input value
- token query 参数原文

## Citation Gate 测试

### 可引用条件
只有成功写入 source artifact 的 WebAccess 结果可生成 B citation。

### 拒绝条件
以下结果不得进入 synthesis：
- 无 URL
- 无 finalUrl
- 无 title
- 无 fetched_at
- 无 content_hash
- artifact 写入失败
- 被 URL policy 阻断
- redaction 标记为 unsafe

## Deep Research 集成测试

### WebAccess 关闭
- deep research 行为与旧流程一致。
- 只使用 Tavily/SerpApi snippets。
- 不调用 WebAccess runner。

### WebAccess 开启但 health 失败
- 显示中文 warning。
- 自动降级旧流程。
- 研究不中断。

### WebAccess 成功
- Tavily/SerpApi 先发现 URL。
- WebAccess 对 top N URL 抓取。
- 成功页面写 raw/sources/web。
- synthesis prompt 包含 B evidence。
- 最终研究文档包含 B1/B2 引用。

### artifact 写入失败
- 不允许该页面进入 synthesis。
- 不允许 autoIngest 失败 artifact。
- trace 记录写入失败原因。

## Phase 4/5 预留测试
当前阶段 click/search/browser-native agent loop 必须不可用或返回明确错误：
- click disabled
- browser search disabled
- login context disabled

错误文案必须简体中文：
- `当前版本未启用页面点击。`
- `当前版本未启用浏览器内搜索。`
- `当前版本未启用登录态页面访问。`

## 验收命令建议

```powershell
npm run test:mocks
npm run build
cargo check
```

后续实现 WebAccess runner 后增加针对 `src/lib/web-access/*.test.ts` 的 focused tests。
