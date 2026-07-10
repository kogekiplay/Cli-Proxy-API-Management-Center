# Monitoring Alias And Status Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让请求监控使用配置的提供商名称和模型 alias 展示、筛选及计价，并用状态码悬浮提示替代独立错误列。

**Architecture:** CPA 用量账本新增 `model_alias` 保存运行时已存在的客户端模型名；分析查询通过请求内的 alias 规则兼容旧记录，并统一以有效模型名聚合和计价。Management 从当前配置生成只读 alias 规则，前端只消费已解析的数据并负责紧凑表格与可访问的状态错误浮层。

**Tech Stack:** Go 1.24、Gin、SQLite、React 19、TypeScript 6、SCSS、Bun/Vitest。

## Global Constraints

- 不改写或清空已有 SQLite 历史记录。
- 新请求同时保留上游模型和客户端 alias。
- 旧请求按当前配置映射 alias；映射冲突时回退原始模型。
- alias 用于筛选、聚合和价格查询，详情仍可查看上游模型。
- 表格固定为 11 列，列宽为 `8 / 12 / 8 / 10 / 6 / 10 / 6 / 12 / 15 / 9 / 4`，最小宽度为 `1320px`。
- 成功状态不显示空错误浮层；失败状态支持鼠标悬停和键盘聚焦。

---

### Task 1: Persist Client Model Alias In The Usage Ledger

**Files:**
- Modify: `/Users/kogeki/dev/CLIProxyAPI/internal/usageledger/types.go`
- Modify: `/Users/kogeki/dev/CLIProxyAPI/internal/usageledger/plugin.go`
- Modify: `/Users/kogeki/dev/CLIProxyAPI/internal/usageledger/sqlite_store.go`
- Test: `/Users/kogeki/dev/CLIProxyAPI/internal/usageledger/plugin_test.go`
- Test: `/Users/kogeki/dev/CLIProxyAPI/internal/usageledger/store_test.go`

**Interfaces:**
- Consumes: `usage.Record.Alias string` from `sdk/cliproxy/usage`.
- Produces: `usageledger.Event.ModelAlias string` and SQLite column `usage_events.model_alias`.

- [ ] **Step 1: Write failing plugin and migration tests**

Add a plugin assertion that the event returned by Analytics preserves both names:

```go
plugin.HandleUsage(ctx, coreusage.Record{
    Provider: "openai-compatible-cf worker",
    Model:    "@cf/zai-org/glm-5.2",
    Alias:    "glm-5.2",
})

row := result.Events.Items[0]
if row.Model != "glm-5.2" || row.UpstreamModel != "@cf/zai-org/glm-5.2" {
    t.Fatalf("model names = %#v", row)
}
```

Create a legacy SQLite database containing `usage_events` without `model_alias`, reopen it with `OpenSQLite`, and assert `PRAGMA table_info(usage_events)` contains `model_alias` while the old row remains readable.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
go test ./internal/usageledger -run 'TestPluginStoresModelAlias|TestOpenSQLiteAddsModelAliasColumn' -count=1
```

Expected: FAIL because `Event.ModelAlias`, `AnalyticsEventRow.UpstreamModel`, and the SQLite column do not exist.

- [ ] **Step 3: Add the event field and SQLite migration**

Add:

```go
type Event struct {
    // existing fields
    Model      string
    ModelAlias string
}
```

Set it in `eventFromRecord`:

```go
Model:      strings.TrimSpace(record.Model),
ModelAlias: strings.TrimSpace(record.Alias),
```

Add `model_alias TEXT NOT NULL DEFAULT ''` to the create statement and `ensureUsageEventColumns`, then include it in both INSERT variants and their argument lists.

- [ ] **Step 4: Read model_alias in analytics without changing behavior yet**

Add `model_alias` to the Analytics SELECT and scan it into `item.event.ModelAlias`. Keep existing cost and grouping behavior until Task 2.

- [ ] **Step 5: Run usage ledger tests**

Run:

```bash
go test ./internal/usageledger -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit the persistence layer**

```bash
git add internal/usageledger/types.go internal/usageledger/plugin.go internal/usageledger/sqlite_store.go internal/usageledger/plugin_test.go internal/usageledger/store_test.go
git commit -m "feat: persist requested model aliases"
```

---

### Task 2: Resolve Alias For Historical Analytics And Pricing

**Files:**
- Create: `/Users/kogeki/dev/CLIProxyAPI/internal/usageledger/model_alias.go`
- Modify: `/Users/kogeki/dev/CLIProxyAPI/internal/usageledger/types.go`
- Modify: `/Users/kogeki/dev/CLIProxyAPI/internal/usageledger/analytics.go`
- Test: `/Users/kogeki/dev/CLIProxyAPI/internal/usageledger/analytics_test.go`

**Interfaces:**
- Consumes: `Event.Model`, `Event.ModelAlias`, `Event.Provider`, `Event.AuthIndex`.
- Produces: `ModelAliasRule`, `AnalyticsRequest.ModelAliases`, `AnalyticsEventRow.UpstreamModel`, and `resolveAnalyticsModel`.

- [ ] **Step 1: Write failing effective-model and pricing tests**

Define cases for stored alias, historical config mapping, conflict fallback, alias pricing, and filtering by either name:

```go
rules := []ModelAliasRule{{
    Provider:      "openai-compatible-cf worker",
    AuthIndex:     "auth-cf",
    UpstreamModel: "@cf/zai-org/glm-5.2",
    Alias:         "glm-5.2",
}}
```

Insert an old event with only `Model: "@cf/zai-org/glm-5.2"`, configure a price for `glm-5.2`, query with `ModelAliases: rules`, and assert:

```go
if got := result.Events.Items[0].Model; got != "glm-5.2" {
    t.Fatalf("model = %q", got)
}
if got := result.Events.Items[0].UpstreamModel; got != "@cf/zai-org/glm-5.2" {
    t.Fatalf("upstream model = %q", got)
}
if result.Events.Items[0].EstimatedCostUSD == nil {
    t.Fatal("alias price was not applied")
}
```

Repeat queries with `Filters.Models` set to `glm-5.2` and `@cf/zai-org/glm-5.2`; both must include the event. Add two conflicting provider-level rules and assert the original model remains unchanged when no auth-index rule disambiguates them.

- [ ] **Step 2: Run the focused analytics tests and confirm failure**

Run:

```bash
go test ./internal/usageledger -run 'TestSQLiteStoreAnalytics.*Alias' -count=1
```

Expected: FAIL because alias rules and upstream-model output are missing.

- [ ] **Step 3: Add alias rule types and resolver**

Add non-JSON query metadata:

```go
type ModelAliasRule struct {
    Provider      string
    AuthIndex     string
    UpstreamModel string
    Alias         string
}

type AnalyticsRequest struct {
    // existing JSON fields
    ModelAliases []ModelAliasRule `json:"-"`
}
```

Implement `resolveAnalyticsModel(event Event, rules []ModelAliasRule) string` with this priority:

```go
if alias := strings.TrimSpace(event.ModelAlias); alias != "" {
    return alias
}
// exact provider + auth index + upstream model
// unique provider + upstream model fallback
return strings.TrimSpace(event.Model)
```

Normalize comparisons case-insensitively while returning the configured alias spelling. Ignore empty and identity mappings.

- [ ] **Step 4: Apply effective model before pricing and aggregation**

During Analytics scanning:

```go
item.upstreamModel = strings.TrimSpace(item.event.Model)
item.event.Model = resolveAnalyticsModel(item.event, req.ModelAliases)
if cost, ok, missing := CostForUsage(item.event.Model, item.tokens, prices); ok {
    // existing cost path
}
```

Add `UpstreamModel string json:"upstream_model,omitempty"` to `AnalyticsEventRow` and populate it only when it differs from the effective model. Existing builders then aggregate and price the effective model consistently.

- [ ] **Step 5: Expand model filters for alias and upstream names**

Replace the simple `addIn("model", req.Filters.Models)` call with a helper that emits:

```sql
(model_alias IN (...) OR model IN (...))
```

The `model` candidates must include the requested values plus upstream models whose configured alias matches a requested value. This keeps filtering in SQLite and avoids loading unrelated 60-day history.

- [ ] **Step 6: Run focused and full usage ledger tests**

Run:

```bash
go test ./internal/usageledger -count=1
```

Expected: PASS, including stored alias, historical fallback, conflict fallback, cost, and both filter names.

- [ ] **Step 7: Commit analytics alias resolution**

```bash
git add internal/usageledger/model_alias.go internal/usageledger/types.go internal/usageledger/analytics.go internal/usageledger/analytics_test.go
git commit -m "feat: resolve model aliases in usage analytics"
```

---

### Task 3: Build Alias Rules From Current CPA Configuration

**Files:**
- Create: `/Users/kogeki/dev/CLIProxyAPI/internal/api/handlers/management/usage_analytics_aliases.go`
- Modify: `/Users/kogeki/dev/CLIProxyAPI/internal/api/handlers/management/usage_analytics.go`
- Test: `/Users/kogeki/dev/CLIProxyAPI/internal/api/handlers/management/usage_analytics_test.go`

**Interfaces:**
- Consumes: `h.openAICompatibilityWithAuthIndex()` and `config.OpenAICompatibilityModel`.
- Produces: `func (h *Handler) usageAnalyticsModelAliases() []usageledger.ModelAliasRule`.

- [ ] **Step 1: Write a failing management endpoint test**

Create a handler config with:

```go
OpenAICompatibility: []config.OpenAICompatibility{{
    Name: "cf worker",
    Models: []config.OpenAICompatibilityModel{{
        Name:  "@cf/zai-org/glm-5.2",
        Alias: "glm-5.2",
    }},
}}
```

Register the corresponding runtime auth, insert a historical event whose provider is `openai-compatible-cf worker`, configure the `glm-5.2` price, call `/v0/management/usage-analytics`, and assert the response model, upstream model, and cost are correct.

- [ ] **Step 2: Run the endpoint test and confirm failure**

Run:

```bash
go test ./internal/api/handlers/management -run TestUsageAnalyticsEndpointResolvesConfiguredModelAlias -count=1
```

Expected: FAIL because the handler does not pass configuration mappings to the ledger.

- [ ] **Step 3: Implement deterministic rule construction**

Build provider IDs as:

```go
provider := "openai-compatible-" + strings.ToLower(strings.TrimSpace(entry.Name))
```

For each non-empty, non-identity model mapping, emit one rule per available provider auth index. Also emit a provider-level rule only when that upstream model maps to exactly one alias for the provider. Sort and deduplicate rules so tests and responses are deterministic.

- [ ] **Step 4: Attach rules before querying the ledger**

In `PostUsageAnalytics`, after JSON decoding and before `store.Analytics`:

```go
req.ModelAliases = h.usageAnalyticsModelAliases()
resp, err := store.Analytics(c.Request.Context(), req)
```

- [ ] **Step 5: Run management and related backend tests**

Run:

```bash
go test ./internal/api/handlers/management ./internal/usageledger -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit configuration mapping**

```bash
git add internal/api/handlers/management/usage_analytics_aliases.go internal/api/handlers/management/usage_analytics.go internal/api/handlers/management/usage_analytics_test.go
git commit -m "feat: map configured aliases in usage analytics"
```

---

### Task 4: Replace Error Column With Status Tooltip And Compact The Table

**Files:**
- Create: `/Users/kogeki/dev/Cli-Proxy-API-Management-Center/src/features/usageAnalytics/UsageStatusBadge.tsx`
- Create: `/Users/kogeki/dev/Cli-Proxy-API-Management-Center/src/features/usageAnalytics/UsageStatusBadge.module.scss`
- Modify: `/Users/kogeki/dev/Cli-Proxy-API-Management-Center/src/services/api/usageAnalytics.ts`
- Modify: `/Users/kogeki/dev/Cli-Proxy-API-Management-Center/src/pages/usageMonitoringColumns.ts`
- Modify: `/Users/kogeki/dev/Cli-Proxy-API-Management-Center/src/pages/UsageAnalyticsPage.tsx`
- Modify: `/Users/kogeki/dev/Cli-Proxy-API-Management-Center/src/pages/UsageAnalyticsPage.module.scss`
- Test: `/Users/kogeki/dev/Cli-Proxy-API-Management-Center/tests/usageMonitoringColumns.test.ts`
- Test: `/Users/kogeki/dev/Cli-Proxy-API-Management-Center/tests/requestMonitoringNavigation.test.ts`

**Interfaces:**
- Consumes: `UsageAnalyticsEventRow.fail_summary`, `fail_body`, `failed`, `status_code`, and `upstream_model`.
- Produces: `monitoringProviderLabel`, 11-column widths, and `UsageStatusBadge`.

- [ ] **Step 1: Write failing frontend structure tests**

Update expected widths:

```ts
expect(MONITORING_COLUMN_WIDTHS).toEqual([8, 12, 8, 10, 6, 10, 6, 12, 15, 9, 4]);
expect(MONITORING_COLUMN_WIDTHS).toHaveLength(11);
```

Add pure provider label cases:

```ts
expect(monitoringProviderLabel('openai-compatible-cf worker')).toBe('cf worker');
expect(monitoringProviderLabel('openai-compatible-opencode-go')).toBe('opencode-go');
expect(monitoringProviderLabel('codex')).toBe('Codex');
```

Assert the page has no error-message `<th>` or `monitoringErrorCell`, uses `UsageStatusBadge`, and exposes `selectedEvent.upstream_model` in the detail drawer only when different.

- [ ] **Step 2: Run focused frontend tests and confirm failure**

Run:

```bash
bun test tests/usageMonitoringColumns.test.ts tests/requestMonitoringNavigation.test.ts
```

Expected: FAIL on 12-column widths, provider label logic, and the retained error column.

- [ ] **Step 3: Add API type and provider label helper**

Add:

```ts
upstream_model?: string;
```

Export `monitoringProviderLabel` from `usageMonitoringColumns.ts`:

```ts
export const monitoringProviderLabel = (value?: string | null) => {
  const provider = value?.trim() ?? '';
  const prefix = 'openai-compatible-';
  if (provider.toLowerCase().startsWith(prefix)) return provider.slice(prefix.length) || 'Unknown';
  if (provider === 'opencode-go') return 'OpenCode';
  if (provider === 'codex') return 'Codex';
  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
};
```

- [ ] **Step 4: Implement the accessible status tooltip**

Create `UsageStatusBadge` that renders a fixed-position portal only when the request failed and error text exists. It must open on pointer enter or focus, close on pointer leave or blur, and use `role="tooltip"` plus `aria-describedby`.

Core behavior:

```tsx
const error = resolveUsageAnalyticsErrorDisplay(row, '请求失败');
const hasError = row.failed && Boolean(error.summary || error.title || error.detail);

return (
  <span className={styles.anchor} onPointerEnter={open} onPointerLeave={close}>
    <span ref={badgeRef} tabIndex={hasError ? 0 : undefined} className={badgeClass}>
      {statusCode}
    </span>
    {hasError && visible ? createPortal(<div role="tooltip">...</div>, document.body) : null}
  </span>
);
```

Position the portal from `getBoundingClientRect()`, clamp it inside the viewport, cap it at 360px wide and 240px high, and preserve wrapped redacted error text.

- [ ] **Step 5: Convert the monitoring table to 11 columns**

Remove the error header, cell, `ErrorSummary`, and `monitoringErrorCell`. Use the new status component, add `title={row.provider}` to the short provider badge, set the table min-width to `1320px`, and render model title text as:

```tsx
title={row.upstream_model && row.upstream_model !== row.model
  ? `${row.model} · 上游 ${row.upstream_model}`
  : row.model || undefined}
```

Add an “上游模型” detail item only when it differs from the alias. Keep the full provider ID in the detail drawer.

- [ ] **Step 6: Run focused and full frontend checks**

Run:

```bash
bun test
bun run type-check
bun run lint
bun run build
```

Expected: all tests pass, TypeScript and ESLint report no errors, and `dist/index.html` is produced.

- [ ] **Step 7: Commit frontend behavior**

```bash
git add src/features/usageAnalytics/UsageStatusBadge.tsx src/features/usageAnalytics/UsageStatusBadge.module.scss src/services/api/usageAnalytics.ts src/pages/usageMonitoringColumns.ts src/pages/UsageAnalyticsPage.tsx src/pages/UsageAnalyticsPage.module.scss tests/usageMonitoringColumns.test.ts tests/requestMonitoringNavigation.test.ts
git commit -m "feat: compact monitoring model and status columns"
```

---

### Task 5: Integration Review, Release, And Deployment

**Files:**
- Verify: `/Users/kogeki/dev/CLIProxyAPI`
- Verify: `/Users/kogeki/dev/Cli-Proxy-API-Management-Center`
- Deploy: `/opt/cli-proxy-api/auth/static/management.html`

**Interfaces:**
- Consumes: completed backend and frontend commits.
- Produces: merged local `main` branches, pushed forks, Management release `v1.17.16-fork`, and updated bastion deployment.

- [ ] **Step 1: Run backend full verification**

```bash
gofmt -w internal/usageledger/types.go internal/usageledger/plugin.go internal/usageledger/sqlite_store.go internal/usageledger/model_alias.go internal/usageledger/analytics.go internal/usageledger/plugin_test.go internal/usageledger/store_test.go internal/usageledger/analytics_test.go internal/api/handlers/management/usage_analytics.go internal/api/handlers/management/usage_analytics_aliases.go internal/api/handlers/management/usage_analytics_test.go
go test ./...
```

Expected: PASS with no formatting diff left by `gofmt`.

- [ ] **Step 2: Run frontend full verification again from a clean build**

```bash
bun test
bun run type-check
bun run lint
bun run build
```

Expected: all checks pass and the single-file build is generated.

- [ ] **Step 3: Review both diffs for scope and secrets**

```bash
git diff main...HEAD --check
git diff main...HEAD --stat
```

Expected: only usage-ledger, management alias mapping, monitoring UI, tests, and approved docs are changed; no private CPA address, API key, password, or cookie appears.

- [ ] **Step 4: Merge feature branches into local main and push**

Use non-interactive fast-forward or merge commits after confirming each main worktree is clean. Push `kogekiplay/CLIProxyAPI:main` and `kogekiplay/Cli-Proxy-API-Management-Center:main`.

- [ ] **Step 5: Publish Management release**

Tag the Management merge commit as `v1.17.16-fork`, push the tag, and verify the GitHub release asset is the fork build named `management.html`.

- [ ] **Step 6: Deploy backend and Management to the bastion**

Use the bastion's configured `127.0.0.1:7890` Git/Docker proxy. Back up the existing binary/container configuration and `/opt/cli-proxy-api/auth/static/management.html`, rebuild or pull the fork image, replace Management with the verified release asset, and restart only the CPA service required for the backend change.

- [ ] **Step 7: Verify live behavior in Chrome**

On `/management.html#/monitoring`, verify:

- `openai-compatible-cf worker` is displayed as `cf worker` in the table.
- `glm-5.2` alias is displayed and uses its configured price for new and historical rows.
- `gpt-5.6-terra` fits without clipping.
- authentication and status columns no longer have the large blank gap.
- there is no error column.
- `200` has no empty tooltip; a real `429/503` shows redacted error details on hover and keyboard focus.
- the detail drawer shows the full provider ID and upstream model when different.

- [ ] **Step 8: Record deployed versions and hashes**

Report the backend version, Management tag, deployed SHA-256, backup path, test totals, and any historical rows that cannot be mapped because their current configuration is ambiguous.
