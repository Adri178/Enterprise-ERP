# Apple-inspired Dashboard comparison

Open `enterprise-erp-dashboard-comparison.figcraft`. The app on control port **7979** is already showing the improved frame. The original remains above it on the same page.

| Frame | Position | Size |
| --- | --- | --- |
| Original Enterprise ERP | x 0, y 0 | 1920 × 1440 |
| Apple-inspired / Liquid Glass | x 0, y 1660 | 1920 × 1440 |

The original frame's complete node tree was checked by SHA-256 before and after editing. Its geometry, text, data, vectors and styling are unchanged. The new frame contains **370 editable layers**, including **121 text layers** and **12 native glass effects**. Its financial values, six-month series and six recent documents use the same Alpha snapshot as the original.

## Direction

The composition follows Apple-inspired restraint: a floating navigation surface, quiet toolbar, pill controls, larger type, continuous corner shapes and subtle elevation. Glass stays on the control/navigation layer; financial metrics, chart and table sit on solid surfaces. This direction follows the [Apple Human Interface Guidelines for materials](https://developer.apple.com/design/human-interface-guidelines/materials).

The effects are real editable FigCraft effects: `glass`, `backgroundBlur`, `innerShadow` and `dropShadow`. They are not a flattened screenshot. Inter is used as a portable typeface; Apple proprietary fonts, logos and SF Symbols are not bundled.

## Tokens and hierarchy

| Token | Value / role |
| --- | --- |
| Canvas | `#F5F6FA` |
| Solid content | `#FFFFFF` |
| Primary ink | `#20232B` |
| Secondary ink | `#626D7E` |
| Accent | `#007AFF`, navigation icons |
| Action | `#0065DB`, white-label primary control |
| Current navigation text | `#0061D1` |
| Positive status | green, separate from the action accent |
| Content radius | 26 px |
| Toolbar/sidebar radius | 28 px |
| Control radius | 22 px |
| Typography | 42 px page title; 33 px values; 20 px section titles; 12–15 px operational text |

The six metrics share one structured summary surface to make comparison easier. The Approval empty state explicitly scopes its message to Purchase Requests. Company, period and chart time range remain visible. The table keeps document references, partners, dates, amounts and statuses, with larger text and calmer separators.

Static token checks measured secondary ink at **4.85:1** against the canvas and white text on the primary action at **5.41:1**. This is not a full interactive accessibility audit. A future implementation should support reduced transparency/motion, visible keyboard focus, focus return and accessible names; native glass refraction/motion is not a live web implementation in this design file.

## Files and verification

- `enterprise-erp-dashboard-comparison.figcraft`: both frames, editable.
- `enterprise-erp-dashboard-apple.png` / `.svg`: improved frame preview.
- `enterprise-erp-dashboard-both.png`: vertical comparison preview.
- `apple-comparison-verification.json`: frame placement, layer/effect counts and original preservation.
- `apple-contrast-check.json`: measured static text/action contrast.
- `apple-dashboard.commands.json`: the native MCP creation batch.

Only the Dashboard design is extended. Application pages, API behavior, database records and mobile scope are unchanged. Use `create-apple-comparison.mjs` only on a base document without the comparison; it rejects duplicate insertion. `refine-apple-contrast.mjs` updates the comparison's text/control colors while retaining the original frame.
