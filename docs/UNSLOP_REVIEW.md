# HUNT UI review

5 November 2026. Local implementation and review; not deployed.

Product: a portal for reviewing recruiting opportunities and sources.
Character: practical, dense, legible.
World: an analyst's work queue.
Moments: status information and review actions.
Signature: consistent table and queue structure.

The desktop-only navigation, rigid grids, small controls, and uncontained tables needed mobile support. Updated portal spacing, wrapping, readable form sizes, text contrast, headings, focus states, and tabular figures. Added a skip link and a labelled navigation landmark. Wrapped tables in 11 views with labelled keyboard-focusable scrolling regions.

Every top-level EJS page template compiled successfully. Actual login and dashboard templates rendered in local fixtures and passed Chromium at 1440, 768, 390 and 320 px. A long unbroken table-cell stress fixture remained inside a 320 px page; keyboard ArrowRight scrolled the focused table region. Evidence: `.artifacts/unslop/verify-table-scroll.json`, login/dashboard verification JSON, and screenshots. Real opportunity searches, approvals, exports, and authenticated server behavior were not exercised.

Method: [unslop by Damir Sokolovsky](https://github.com/heydamir/unslop), licensed CC BY 4.0. Applied product-specific polish; retained existing brand decisions. Screenshots and fixtures are local review evidence, not production data or a full accessibility certification.

