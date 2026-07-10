# Request Monitoring Table Density Design

## Goal

Make the request-monitoring table easier to scan while using less horizontal space. Provider and model must be independent columns, and status code must no longer share a cell with error text.

## Table Structure

The table will use twelve stable columns in this order:

1. Time
2. Request
3. Provider
4. Model
5. Reasoning effort
6. Credential / API key
7. Status code
8. Error message
9. Latency / TTFT
10. Token usage
11. Cost
12. Action

The existing fixed-layout table remains in place so rows stay aligned while data changes. The twelve percentage widths, in column order, will be `[8, 11, 7, 7, 6, 12, 6, 8, 11, 13, 7, 4]`. They total 100 percent and leave enough content width for the fixed-size status badge after cell padding. The minimum table width will be reduced from 1580px to 1440px, and cell padding will change from `15px 18px` to `13px 12px`.

Provider and model receive separate compact widths. Provider keeps the existing colored identity badge and compact monitoring label. Model is rendered as one ellipsized text line, with the full value available through the row detail view and a native title tooltip.

## Status And Error Behavior

The status-code column is a narrow, centered column containing only the existing status badge.

The error-message column is independent:

- Successful rows leave the cell empty.
- Failed rows show one ellipsized summary line.
- Hovering or focusing the summary keeps the existing detailed error tooltip.
- Opening the row detail remains the authoritative way to inspect the complete provider, model, and error payload.

Separating these cells prevents failed rows from widening or vertically unbalancing the status column, while successful `200` rows remain visually centered.

## Responsive And Visual Constraints

- Preserve horizontal scrolling when the viewport is narrower than the table.
- Keep every row vertically centered and avoid wrapping primary cell content.
- Do not change monitoring filters, paging, row selection, detail behavior, or API data contracts.
- Keep the current Claude-inspired colors, badges, failed-row tint, and typography.

## Verification

Automated tests will verify:

- Twelve column widths are defined and total 100 percent.
- Provider and model have separate headers and cells.
- Status and error have separate headers and cells.
- Successful rows do not render placeholder error text.
- The compact table width and padding rules are present.

The production build and the full relevant test suite must pass. A browser screenshot at the deployed desktop viewport will be used to confirm alignment, truncation, row height, and horizontal density before deployment is considered complete.
