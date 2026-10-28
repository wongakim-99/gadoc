# Workspace Projects

Workspaces can group existing channels, issues and a representative document by
project. This is an organization layer inside the existing workspace, not another
workspace or a separate issue database.

## Data And Permissions

- `workspace_projects` stores project metadata in the existing MongoDB database.
- `issues.projectId` identifies the project. Moving an issue preserves its ID,
  status, assignees, links, custom database values and original creation time.
- Owners/admins manage project names, channel bindings and representative pages.
  Writable members can create and reclassify issues. Guests can read only.
- Projects are not a new permission boundary. Existing channel/document access
  checks still apply. Hidden resource IDs are redacted from project responses.
- An admin who cannot see an existing private binding cannot accidentally erase
  it by saving a redacted form. Someone with access must change that binding.
- Project names and channel bindings are unique within a workspace. Updates use
  a revision predicate; stale writes return HTTP 409.

## Chat, Board And Database

Creating an issue from a chat message inherits its channel's project, unless a
project is selected explicitly. References do not change ownership. Unmapped DM
origins remain unclassified; they are not assigned based on a later reference.

The board accepts `?project=<id>` or `?project=unassigned`. The database uses the
same canonical issue source and records, with the same scope maintained through
table, calendar and timeline view changes. Creating an issue from a scoped
database view inherits that scope. No issue or document copies are created.

Project changes invalidate other team members' open project navigation. Resource
titles and private references are not included in the invalidation event.

## Existing Data

No automatic production data migration runs at startup. Before assigning existing
issues, take a database backup and review a classification plan. The pure
`planIssueProjectAssignments` helper follows only authorized origin-message
relationships, preserves manually assigned projects, and records `updatedAt` for
compare-and-set application. Ambiguous, missing and foreign origins require
review. Never replace a whole issue document to apply classification.

Project grouping is distinct from arbitrary parent/child task dependencies. The
latter should not be represented by fabricated labels or duplicate issue rows.

## Verification

`tests/e2e/issue-projects.e2e.spec.ts` covers real API/MongoDB permission and unique
index behavior, stale writes, origin inference, cross-project references, stable
issue IDs, scoped board/DB creation, project management, mobile layout and
calendar/timeline scope persistence. Domain and service tests additionally cover
hidden documents, private bindings and classification safety.
