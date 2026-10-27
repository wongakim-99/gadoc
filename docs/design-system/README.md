# Workspace design system — first application

Status: visual review pending. This is an iteration on the existing Slacord application, not the withdrawn standalone prototypes.

## Scope

The shared workspace shell, chat, document editor menus, issues, settings, search and dialogs use a charcoal surface palette with blue actions. Existing navigation, document hierarchy, autosave and backend contracts are preserved. Marketing/auth screens retain their existing palette. Light theme is not implemented in this change.

| Role | Token | Value |
| --- | --- | --- |
| Canvas | bg-primary | #181b20 |
| Sidebar / surface | bg-secondary | #20242b |
| Raised surface | bg-tertiary | #282e38 |
| Main text | text-primary | #edf0f5 |
| Secondary text | text-secondary | #bdc5d2 |
| Muted text | text-muted | #8996a9 |
| Border | border-primary | #343c49 |
| Primary action | action | #4668d9 |
| Primary action hover | action-hover | #3c5ecb |
| Link / selected label | action-text | #a8bdff |
| Selected navigation | selection | #283653 |

Blue identifies actions and location. Green, amber and red retain success, warning and error meanings. Existing Slack/Discord token names remain compatibility aliases. Workspace logo geometry is unchanged, with a new color variant. Control/panel radius tokens are 6px/12px; existing layout dimensions are preserved. This first pass does not migrate every legacy component radius or hardcoded status shade.

## Actual application captures

Synthetic test data only. These are application screenshots, not mockups.

- [Chat](assets/chat.png)
- [Issues](assets/issues.png)
- [Settings after data load](assets/settings.png)
- [Document editor](assets/document-desktop.png)
- [Mobile document navigation](assets/document-mobile.png)
- [Issue modal](assets/issue-modal.png)

## Verification

- Web TypeScript check passed.
- 74 web unit tests passed.
- 9 existing document/workspace browser cases passed, covering autosave/retry, hierarchy, navigation, read-only/mobile and keyboard/reduced-motion behavior.
- Added contrast regression: 19 foreground/background token combinations meet 4.5:1; verifies rendered action color and focus outline. This is not a full accessibility audit.
- 5 live API/browser cases passed: hierarchy, issues, command actions, settings and huddle. Huddle media uses synthetic test streams; multi-user audio quality is not verified.
- Actual seeded chat, issue and settings captures verified; contrast/keyboard cases rerun after final dialog styling.

## Review and next iteration

Review at http://127.0.0.1:3002. Check document readability, restrained blue emphasis, sidebar location cues and consistent surfaces while navigating. User aesthetic acceptance is pending; test success does not mean the design is complete. Database features remain separate product work.

Local web startup requires `NEXT_PUBLIC_SOCKET_URL=http://127.0.0.1:8082` when the web runs on 3002 and backend on 8082. Without it, the browser attempts Socket.IO on the web origin and the huddle start button remains disconnected. This session corrected the process environment, not application permissions.
