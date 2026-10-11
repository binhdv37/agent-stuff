# Agent Stuff

Reusable workflows and agent roles for OpenCode, Codex, and Claude Code.

Agent Stuff helps you give your AI coding tool a repeatable way to handle tasks
such as documenting an API, explaining code, or handing work over to another
session. Choose the workflows you need and install them into your tool, globally
or for a specific project.

The reusable components are called **stuff**: skills provide workflows, commands
provide shortcuts to workflows, and agents provide specialized roles and working
boundaries. Your AI tool runs them using the code and context you provide.

## What you can use it for

A few examples from the collection:

| When you need to… | Try | Expected result |
|---|---|---|
| Help frontend engineers integrate a backend API | [bdv-api-handoff](core/skills/bdv-api-handoff/instructions.md) | Markdown documentation of requests, responses, errors, and frontend-relevant behavior |
| Understand unfamiliar code | [bdv-explain-code](core/skills/bdv-explain-code/instructions.md) | An explanation of the code and how it works |
| Continue work in another session | [bdv-handoff](core/skills/bdv-handoff/instructions.md) | A concise handoff document with sensitive information redacted |

These are examples, rather than a complete catalog. To see the available stuff
and descriptions from your checkout, run:

```bash
bash install.sh list
```

You can also browse the [skills](core/skills/), [agents](core/agents/), and
[commands](core/commands/) before installing. The installer reports which items
work with your chosen tool.

## Supported tools

| Tool | Skills | Commands | Agents |
|---|---|---|---|
| OpenCode | Supported; explicit invocation has a reported limitation | Separate commands | Primary agents and the planner's read-only review helper |
| Codex | Supported, including native invocation policy | Use the corresponding skills | Not mapped by this adapter |
| Claude Code | Supported, also available as slash commands | Use skill slash commands | Not mapped by this adapter |

Support describes the current adapters. Some metadata or activation behavior
cannot be fully preserved; the installer shows the limitations before you apply
changes. In OpenCode, explicit-only invocation is expressed through instructions
rather than native enforcement.

See [compatibility](docs/compatibility.md) for details and version baselines, and
[verification results](docs/verification/README.md) for recorded workflow checks
and remaining gaps. Installation support alone does not mean every workflow has
been verified in your tool.

## Get started

You need **Node.js 22+**, **npm**, **Git**, and the AI tool you want to use.
The filesystem installer is tested on macOS; its launcher and filesystem
operations are intended for macOS/Linux.

```bash
git clone https://github.com/binhdv37/agent-stuff.git
cd agent-stuff
bash install.sh
```

The launcher installs dependencies if needed and builds the CLI. The installer
then asks you to:

1. Choose OpenCode, Codex, or Claude Code.
2. Choose **global** scope for use across projects, or **project** scope for one
   existing project directory.
3. Select stuff using the displayed keys, such as `skill/bdv-api-handoff`.
4. Review the proposed file changes and any compatibility limitations, then
   confirm installation.

To use a particular source version, check out that tag or commit before running
the launcher.

## Use an installed workflow

For example, to prepare API documentation with Codex:

1. Run `bash install.sh`, choose `codex` and `project`, and enter the path to your
   backend project.
2. Select `skill/bdv-api-handoff`, review the preview, and confirm installation.
3. Open a new Codex session in that backend project and make an explicit request:

```text
Use bdv-api-handoff to document the orders API for frontend integration.
Start from the routes and handlers in src/orders.
```

Replace the API name and path with your own. The workflow inspects the
implementation and prepares Markdown covering the request and response contract,
authentication, errors, and behavior relevant to the frontend. It asks for
clarification when product meaning cannot be established from the code.

For other skills, explicitly name the workflow and describe the target or outcome
you want. Most skills require explicit invocation; check the selected skill's
`definition.yaml` for its activation policy. Claude Code also exposes skills as
slash commands; OpenCode provides separate commands for selected workflows.

## Preview, update, and remove

From your checkout, you can preview a specific installation without changing the
target project:

```bash
bash install.sh install --agent codex --scope project \
  --project /path/to/backend --only skill/bdv-api-handoff --dry-run
```

For the same project, preview an update or removal:

```bash
bash install.sh update --agent codex --scope project \
  --project /path/to/backend --dry-run

bash install.sh uninstall --agent codex --scope project \
  --project /path/to/backend --dry-run
```

Remove `--dry-run` to review and confirm applying the changes. For a global
installation, use `--scope global` and omit `--project`. Update uses the source
recorded at installation unless you supply `--source /path/to/checkout`.

For scripted installation, provide the selection flags and `--yes`. Items
reported as limited also require `--accept-limitations` after you review them.
`--yes` does not accept limitations or bypass file conflicts. Run
`bash install.sh --help` for available options.

### Common installation issues

- **Unsupported selection:** choose items supported by your tool, or use
  `--compatible-only` when installing to select only compatible items. Compatible
  items may still have limitations that need your acceptance.
- **File conflict:** existing unmanaged files, including files from the old
  installer, are preserved. Back up and move conflicting files before retrying;
  the installer does not automatically adopt them or overwrite local edits.
- **Locally edited installed files:** update and uninstall stop when they would
  overwrite or remove modified files. Preserve your edits before resolving the
  conflict. Unrelated files are left in place.
- **Interrupted installation:** run `bash install.sh recover` with the same
  `--agent`, `--scope`, and project path as the interrupted operation.

## How it works

Agent Stuff keeps shared workflow content in `core/`. An adapter translates it
into files your chosen tool understands, and the installer places and tracks
those files in global or project scope. Your AI tool discovers the installed
content and runs the workflows. You can install only what you need and manage
those files later through the same CLI.

## Further reading

- [Compatibility and limits](docs/compatibility.md)
- [Workflow verification results](docs/verification/README.md)
- [CLI and recovery details](docs/adapter-development.md)
- [Contributing and repository instructions](AGENTS.md)
