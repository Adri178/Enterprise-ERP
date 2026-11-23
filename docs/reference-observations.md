# ERPNext reference observations

Observed passively through the installed REA CLI and the user-supplied CDP endpoint on 21 October 2026. The user manually opened Supplier. The agent did not navigate or mutate the reference. No credentials, cookies, tokens, private records, or source code were collected.

## Home (observed)

- URL: https://erpnext-demo.frappe.cloud/app/home
- REA screenshot evidence: `ev_048ad4cf00d67dc6169a54ef845c5d39e76a809f23eccda30864677c7bd44581`.
- Viewport: 1920 × 970. The reference used a dark theme.
- Compact header: global command search, notifications, help, avatar.
- Persistent sidebar: line icons, active row, expandable module groups, separate page title.
- Workspace: shortcut links, small counters, grouped Reports & Masters links.
- P&L chart area was visible, but plotted data was not rendered in this viewport.

## Supplier

- URL: https://erpnext-demo.frappe.cloud/app/supplier
- Passive DOM inspection: `ev_f11c013c9b04b5815fbc5ce19b8edc900a8a016c9a477b7a6725fc917fbb32ba`.
- Screenshot capture timed out twice (`provider_timeout`); visible list styling was not verified. Do not infer complete list-view behavior from the passive DOM snapshot.

## Boundaries and adaptation

Forms, dialogs, detail pages, responsive behavior, and additional dashboards were not directly navigated or tested in the reference. They follow the brief and official documentation, rather than a claim of direct observation.

Original implementation: light workspace, restrained green actions, original Enterprise ERP identity, company context in the header, compact operational Dashboard, reusable list views, structured forms. Navigation follows the requested hierarchy.

Documentation for list/form/report patterns:

- [Frappe Desk](https://docs.frappe.io/framework/user/en/desk)
- [Frappe List API](https://docs.frappe.io/framework/user/en/api/list)

## Design direction

Continuation note: the Supplier tab was listed again on 21 October 2026, but passive re-inspection timed out while enabling the CDP Page domain. No new Supplier visual/detail/form observations were obtained. A separate local demo Dashboard screenshot succeeded at 1920 × 970 before activating the API preview. The new Procurement workflow is an original implementation based on the project brief, not a claim of observing ERPNext transaction forms.

- Visual thesis: a quiet, light workspace with precise spacing, fine dividers, and one green accent.
- Content plan: company context and actions, KPIs, financial trend and approvals, shortcuts, recent documents and Stock context.
- Interaction thesis: brief page entrances, sidebar width transitions, menu/dialog presence; reduced-motion support.
