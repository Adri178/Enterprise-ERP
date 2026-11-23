# Enterprise ERP Dashboard

**Prototype interaktif desktop:** buka [enterprise-erp-dashboard-prototype.figcraft](enterprise-erp-dashboard-prototype.figcraft), lalu Present / Play → **Enterprise ERP · Desktop interaktif**. Company Switcher, submenu, daftar/filter, detail dokumen, dan form simulasi memakai interaksi native FigCraft. Lihat [panduan dan batasan prototype](PROTOTYPE.md).

**Latest:** open `enterprise-erp-dashboard-comparison.figcraft` for the original Dashboard and an Apple-inspired Liquid Glass variant directly below it. See [design direction and verification](APPLE-DESIGN.md). The preview `enterprise-erp-dashboard-apple.png` shows the improved frame; `enterprise-erp-dashboard-both.png` shows both.

Native editable FigCraft design generated through the FigCraft MCP server (stdio JSON-RPC), using batch, save_file, export and inspect_document.

Frame: 1920 × 1440. Scope: existing desktop operational Dashboard only. Source: globals.css, app-shell.tsx, operational-dashboard.tsx, navigation.ts and i18n.ts. No application source was changed. Text, shapes, Lucide-based vectors, cards and table are editable native layers.

Current browser CDP is unavailable, so pixel-for-pixel matching has not been visually verified. Data uses a read-only Alpha database snapshot.

Open enterprise-erp-dashboard-live.figcraft in FigCraft. PNG/SVG previews are included. dashboard.commands.json retains native creation commands.
