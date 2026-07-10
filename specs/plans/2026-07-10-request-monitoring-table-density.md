# Request Monitoring Table Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split provider/model and status/error into independent request-monitoring columns while reducing wasted horizontal space.

**Architecture:** Keep the existing fixed-layout HTML table and its row-detail behavior. Expand the column contract from ten to twelve stable percentage widths, render each new dimension in its own table cell, and tighten only the monitoring table's sizing styles.

**Tech Stack:** React 19, TypeScript 6, SCSS modules, Bun test runner, Vite single-file production build.

## Global Constraints

- Use twelve columns in this order: time, request, provider, model, reasoning effort, credential/API key, status code, error message, latency/TTFT, token usage, cost, action.
- Use exact percentage widths `[8, 11, 7, 7, 6, 12, 6, 8, 11, 13, 7, 4]`; they must total 100 percent.
- Set the monitoring table minimum width to `1440px` and cell padding to `13px 12px`.
- Successful rows render no error placeholder; failed rows render one ellipsized summary with the existing tooltip and row-detail behavior.
- Preserve filters, paging, row selection, API contracts, provider badge colors, failed-row tint, and horizontal scrolling.
- Do not touch or commit the existing untracked `.codegraph/`, `design-qa.md`, or `docs/` paths.

---

### Task 0: Repair The Dashboard Visual Baseline

**Files:**
- Modify: `tests/visualDirectionAdoption.test.ts`

**Interfaces:**
- Consumes: the current full-width `DashboardPage` structure introduced by commit `674817a`.
- Produces: visual-direction assertions that protect the current `mainColumn` and `systemOverview` layout without restoring the removed `rightRail`, time card, or Gateway Health card.

- [ ] **Step 1: Reproduce the stale assertions**

Run:

```bash
bun test tests/visualDirectionAdoption.test.ts
```

Expected: 2 failures because the test still requires `rightRail` and `dashboard.gateway_health`, both intentionally removed from production code.

- [ ] **Step 2: Replace old right-rail expectations with current layout expectations**

In the first test, replace the `rightRail` source and style assertions with:

```ts
expect(dashboard).toContain('mainColumn');
expect(dashboard).toContain('systemOverview');
expect(dashboardStyles).toContain('.mainColumn');
expect(dashboardStyles).toContain('.systemOverview');
expect(dashboard).not.toContain('className={styles.rightRail}');
expect(dashboardStyles).not.toContain('.rightRail');
```

Rename the final test to `keeps the dashboard full width with status and time in system overview` and replace its removed Gateway Health expectations with:

```ts
expect(dashboard).toContain("t('dashboard.system_status'");
expect(dashboard).toContain("t('dashboard.current_time'");
expect(dashboard).toContain('className={styles.systemOverview}');
expect(dashboard).not.toContain("t('dashboard.gateway_health'");
expect(dashboard).not.toContain('className={styles.rightRail}');
expect(styles).not.toContain('.rightRail');
```

Keep the existing masthead ordering, `grid-column: 1 / -1`, and removed `padding-top: 146px` assertions.

- [ ] **Step 3: Verify the focused test passes**

Run:

```bash
bun test tests/visualDirectionAdoption.test.ts
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 4: Verify the full baseline passes**

Run:

```bash
bun test
```

Expected: 64 tests pass, 0 fail.

- [ ] **Step 5: Commit the baseline repair**

```bash
git add tests/visualDirectionAdoption.test.ts
git commit -m "test: align dashboard visual assertions"
```

---

### Task 1: Lock The Twelve-Column Contract

**Files:**
- Modify: `tests/usageMonitoringColumns.test.ts`
- Modify: `src/pages/usageMonitoringColumns.ts`

**Interfaces:**
- Consumes: `MONITORING_COLUMN_WIDTHS`, imported by `UsageAnalyticsPage.tsx` for its `<colgroup>`.
- Produces: `readonly [8, 11, 7, 7, 6, 12, 6, 8, 11, 13, 7, 4]` and the unchanged `formatReasoningEffort(value)` helper.

- [ ] **Step 1: Write the failing column-contract test**

Replace the existing length-only test with:

```ts
test('defines twelve compact columns totaling 100 percent', () => {
  expect(MONITORING_COLUMN_WIDTHS).toEqual([8, 11, 7, 7, 6, 12, 6, 8, 11, 13, 7, 4]);
  expect(MONITORING_COLUMN_WIDTHS).toHaveLength(12);
  expect(MONITORING_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0)).toBe(100);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bun test tests/usageMonitoringColumns.test.ts
```

Expected: FAIL because the current value has ten entries and equals `[8, 12, 14, 7, 14, 8, 11, 14, 7, 5]`.

- [ ] **Step 3: Implement the new width contract**

Change `src/pages/usageMonitoringColumns.ts` to:

```ts
export const MONITORING_COLUMN_WIDTHS = [8, 11, 7, 7, 6, 12, 6, 8, 11, 13, 7, 4] as const;

export const formatReasoningEffort = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized || '-';
};
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
bun test tests/usageMonitoringColumns.test.ts
```

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Commit the column contract**

```bash
git add tests/usageMonitoringColumns.test.ts src/pages/usageMonitoringColumns.ts
git commit -m "test: define compact monitoring columns"
```

---

### Task 2: Split Provider, Model, Status, And Error Cells

**Files:**
- Modify: `tests/requestMonitoringNavigation.test.ts`
- Modify: `src/pages/UsageAnalyticsPage.tsx:2256-2365`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/zh-TW.json`

**Interfaces:**
- Consumes: `monitoringProviderLabel(row.provider)`, `providerToneClass(row.provider)`, `StatusBadge`, and `ErrorSummary`.
- Produces: separate provider, model, status, and error table cells without changing `UsageAnalyticsEventRow` or row-detail state.

- [ ] **Step 1: Write failing structure tests**

Add this test to `tests/requestMonitoringNavigation.test.ts`:

```ts
test('splits provider, model, status, and error into independent columns', () => {
  const page = read('src/pages/UsageAnalyticsPage.tsx');
  const zhCN = read('src/i18n/locales/zh-CN.json');

  expect(page).toContain("<th>{t('usage_analytics.provider')}</th>");
  expect(page).toContain("<th>{t('usage_analytics.model')}</th>");
  expect(page).toContain("<th>{t('usage_analytics.error_message')}</th>");
  expect(page).not.toContain('<th>提供商 / 模型</th>');
  expect(page).toContain('className={styles.monitoringModelCell}');
  expect(page).toContain('className={styles.monitoringErrorCell}');
  expect(page).toContain('title={row.model || undefined}');
  expect(zhCN).toContain('"provider": "提供商"');
  expect(zhCN).toContain('"error_message": "错误信息"');
});
```

Extend the existing successful-status test with:

```ts
expect(page).toContain('<StatusBadge row={row} />');
expect(page).toContain(
  '<ErrorSummary row={row} emptyLabel={t(\'usage_analytics.no_error_summary\')} />'
);
```

- [ ] **Step 2: Run the navigation test and verify RED**

Run:

```bash
bun test tests/requestMonitoringNavigation.test.ts
```

Expected: FAIL because the table still has combined provider/model and status/error cells.

- [ ] **Step 3: Split the headers and row cells**

In `UsageAnalyticsPage.tsx`, replace the combined headers with:

```tsx
<th>{t('usage_analytics.provider')}</th>
<th>{t('usage_analytics.model')}</th>
<th className={styles.monitoringCenterColumn}>
  {t('usage_analytics.reasoning_effort')}
</th>
<th>认证 / API Key</th>
<th className={styles.monitoringCenterColumn}>{t('usage_analytics.status_code')}</th>
<th>{t('usage_analytics.error_message')}</th>
```

Add `usage_analytics.error_message` beside `error_summary` with these exact values:

- `en.json`: `"error_message": "Error message"`
- `ru.json`: `"error_message": "Сообщение об ошибке"`
- `zh-CN.json`: `"error_message": "错误信息"`
- `zh-TW.json`: `"error_message": "錯誤資訊"`

Change the existing Simplified Chinese `usage_analytics.provider` value from `Provider` to `提供商` and the Traditional Chinese value from `Provider` to `供應商`. English and Russian keep their existing provider labels.

Replace the combined provider/model cell with:

```tsx
<td>
  <div className={styles.monitoringProviderCell}>
    <span className={`${styles.identityBadge} ${providerToneClass(row.provider)}`}>
      {monitoringProviderLabel(row.provider)}
    </span>
  </div>
</td>
<td>
  <div className={styles.monitoringModelCell} title={row.model || undefined}>
    <strong>{row.model || '-'}</strong>
  </div>
</td>
```

Replace the combined status/error cell with two cells:

```tsx
<td className={styles.monitoringCenterColumn}>
  <div className={styles.monitoringStatusCell}>
    <StatusBadge row={row} />
  </div>
</td>
<td>
  <div className={styles.monitoringErrorCell}>
    <ErrorSummary row={row} emptyLabel={t('usage_analytics.no_error_summary')} />
  </div>
</td>
```

- [ ] **Step 4: Run the navigation test and verify GREEN**

Run:

```bash
bun test tests/requestMonitoringNavigation.test.ts
```

Expected: all request-monitoring navigation tests pass.

- [ ] **Step 5: Commit the semantic table split**

```bash
git add tests/requestMonitoringNavigation.test.ts src/pages/UsageAnalyticsPage.tsx src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/zh-CN.json src/i18n/locales/zh-TW.json
git commit -m "feat: split monitoring table dimensions"
```

---

### Task 3: Tighten Monitoring Table Density

**Files:**
- Modify: `tests/requestMonitoringNavigation.test.ts`
- Modify: `src/pages/UsageAnalyticsPage.module.scss:1328-1482`

**Interfaces:**
- Consumes: SCSS module class names emitted by Task 2.
- Produces: compact fixed-layout sizing, ellipsis behavior, and vertically centered status/error cells.

- [ ] **Step 1: Write failing density tests**

Add these assertions to the dedicated console-layout test:

```ts
expect(styles).toContain('min-width: 1440px;');
expect(styles).toContain('padding: 13px 12px;');
expect(styles).toContain('.monitoringModelCell');
expect(styles).toContain('.monitoringErrorCell');
expect(styles).toContain('max-width: 100%;');
```

- [ ] **Step 2: Run the navigation test and verify RED**

Run:

```bash
bun test tests/requestMonitoringNavigation.test.ts
```

Expected: FAIL because the stylesheet still uses `1580px`, `15px 18px`, and has no model/error cell classes.

- [ ] **Step 3: Implement compact SCSS rules**

In `UsageAnalyticsPage.module.scss`:

```scss
.monitoringTable {
  width: 100%;
  min-width: 1440px;
  table-layout: fixed;
  border-collapse: collapse;

  th,
  td {
    padding: 13px 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--ops-panel-border) 84%, transparent);
    text-align: left;
    vertical-align: middle;
  }
}
```

Include the new cells in the shared grid rule:

```scss
.monitoringRequestCell,
.monitoringProviderCell,
.monitoringModelCell,
.monitoringCredentialCell,
.monitoringStatusCell,
.monitoringErrorCell,
.monitoringLatencyCell,
.monitoringUsageCell,
.monitoringCostCell {
  display: grid;
  gap: 4px;
  min-width: 0;
}
```

Replace the old two-item provider grid with:

```scss
.monitoringProviderCell {
  align-items: center;

  .identityBadge {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.monitoringModelCell {
  align-content: center;

  strong {
    min-width: 0;
    overflow: hidden;
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 750;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.monitoringErrorCell {
  min-height: 24px;
  align-content: center;

  .errorHint {
    max-width: 100%;
  }
}
```

Change `.monitoringCostCell` to `min-width: 0;` so it cannot override its compact column width.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
bun test tests/requestMonitoringNavigation.test.ts tests/usageMonitoringColumns.test.ts
```

Expected: all tests pass, 0 fail.

- [ ] **Step 5: Commit the density styles**

```bash
git add tests/requestMonitoringNavigation.test.ts src/pages/UsageAnalyticsPage.module.scss
git commit -m "style: compact request monitoring table"
```

---

### Task 4: Full Verification And Browser QA

**Files:**
- Verify only; no intended source changes.

**Interfaces:**
- Consumes: the completed monitoring table and existing production build pipeline.
- Produces: evidence that tests, lint, TypeScript, build output, and desktop rendering are correct.

- [ ] **Step 1: Run the complete relevant test suite**

```bash
bun test tests/requestMonitoringNavigation.test.ts tests/usageMonitoringColumns.test.ts tests/usageAnalyticsFilterOptions.test.ts
```

Expected: all tests pass, 0 fail.

- [ ] **Step 2: Run static verification**

```bash
bun run type-check
bun run lint
bun run build
```

Expected: every command exits 0 and `dist/management.html` is generated.

- [ ] **Step 3: Inspect the production page in a desktop browser**

Start the preview server:

```bash
bun run preview --host 127.0.0.1 --port 4173
```

Open the request-monitoring route, authenticate against the configured CPA endpoint, and capture a screenshot at the user's current desktop viewport. Verify:

- Provider and model are visibly separate columns.
- `gpt-5.6-terra` is not followed by excessive blank space.
- Successful `200` badges are vertically centered with no second line.
- Failed rows show a one-line error summary in the error column.
- Hovering the error summary shows the existing detailed tooltip.
- No cell text overlaps, and the row-detail button still opens the correct request.

- [ ] **Step 4: Review the final diff and repository state**

```bash
git diff --check origin/main...HEAD
git status --short
```

Expected: no whitespace errors; only the pre-existing untracked `.codegraph/`, `design-qa.md`, and `docs/` paths remain.
