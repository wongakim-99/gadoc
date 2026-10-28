# Source Merge History

Some completed pull requests were originally squash-merged. Their source changes
were present, but their original commit IDs were not ancestors of `dev`/`main`.
The original histories are reconciled without replaying or reverting newer code.

| Original Commit | Completed PR | Squash Commit |
| --- | --- | --- |
| `92046709aada6298246f80067c8ca67dc19a3a76` | #17 | `9aed26db` |
| `9d077cdb75e700723e502e6b724a7afa45f618ff` | #22 | `9f2a8c24094ac0f81ee682a8aec5b4c1dd91ce74` |
| `96f55fb1aa94b94242a4aa746ea2046daa5c3e57` | #15 | `b2ca06721b8d6ae08d68b81dd784653c9241279f` |

Before each history merge, `git merge-tree --write-tree` reported no conflicts and
the exact same source tree as the already verified main content. For the latter
two commits this tree was `9c8a03d796ae57dfcb7d8e43d2d5f02e20b1d7d9`.
GitHub's completed PR head IDs were also checked against the original commits.

An ancestry-only merge does not update installed infrastructure scripts, rotate
credentials, change SSH, or publish new desktop installers. Those operations need
their own verification. Conflicting historical branches are not force-merged.
