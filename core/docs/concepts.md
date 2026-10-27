# Core concepts

Core defines reusable knowledge, workflows, and agent roles, together with their
configuration and supporting resources. These are organized as skill, command,
and agent definitions, collectively called **stuff**. Their meaning is independent
of any particular execution environment.

## Skills, commands, and agents

### Skill

A skill packages reusable instructions and supporting resources that give an
agent specialized knowledge or a repeatable way to perform a task. It can contain
a workflow, reference guidance, templates, or scripts.

Skills commonly use **progressive disclosure**: a name and description support
discovery, while full instructions and supporting resources are loaded as needed.
This is separate from who may invoke the skill. Core defines two activation modes:

- `explicit` (default): the user must explicitly request the workflow or name the
  skill. An exact skill name is not required when the workflow is clearly requested.
- `matching-request`: the model may select the skill when the request matches its
  purpose. This permits automatic invocation; it does not guarantee it.

An explicit-only skill can still load on demand. Activation describes when using
the skill is permitted, not how its content is loaded.

### Command

A command is a reusable prompt template or set of instructions invoked explicitly
by the user, often through a slash command, with optional arguments. Here,
"command" means a custom prompt command, not a shell command or a built-in action
such as `/help` or `/undo`.

Commands provide a user-chosen entry point; skills may also be selected by the
model when their activation mode permits it. A command's prompt can enter the
conversation only when invoked, so on-demand loading is not exclusive to skills.

In Agent-stuff schema v1, a command references one skill through
`workflow: skill/<id>`. It has no independent instruction body or resources;
the skill owns the workflow so it is maintained once. The definition does not
specify an argument parser or native placeholder syntax.

### Agent

An agent is an AI assistant configured for a particular role or area of
responsibility, with instructions that guide its behavior and permissions that
govern its actions. Core represents these as an agent definition.

The `role` describes how the agent participates:

- `primary`: the main assistant the user works with directly.
- `delegated`: a helper invoked by another agent for a task.

Instructions define expertise, approach, and working style. The execution `policy`
defines permissions. Describing an agent as "read-only" does not deny write access;
that restriction must be declared in the execution policy and enforced. The role is
part of the agent's declared behavior, not merely a display label.

## How they relate

`install_with` declares directed installation companions on any stuff definition.
Selecting an item includes its companions by default, transitively and without
duplicates even in cycles. Users may omit companions for a partial installation.
Selecting a companion does not select its parent. This relation neither grants
permissions nor proves that a workflow is ready: required helpers must still be
available at runtime. `policy.delegation_targets` separately restricts which helpers
an agent may invoke; it does not select files for installation.

A skill supplies knowledge or a way to do a task; a command provides an explicit
entry point; an agent supplies the assistant's role and execution permissions.
They have distinct responsibilities even when their instructions overlap.

For example, a skill owns a workflow, while a command can reference that skill
as a user-invoked entry point.
Separately, `agent/solution-architect` defines an architecture advisor: its
instructions guide the advice, and its policy denies workspace writes and shell
execution.

## Instructions, configuration, and resources

- **Instructions** describe what the agent should know or do: procedures,
  reference guidance, and role-specific behavior.
- **Configuration** declares structured properties such as activation, role,
  workflow references, and permissions. Core defines their types, defaults,
  scope, meaning, and valid combinations.
- **Supporting resources** are declared files used by the instructions, such as
  references, templates, or scripts. Their bytes and references are part of the
  definition.

`definition.yaml` contains identity, descriptions, display metadata, configuration,
and file references; it is not purely configuration. In particular, `description`
can affect discovery, while display metadata serves presentation. Configuration
captures portable behavior rather than environment-specific syntax or personal
deployment preferences.

## Contract and validation

A definition's **contract** is its declared meaning and requirements: expected
behavior, inputs and outputs, constraints, and criteria for checking results.
These are expressed through both instructions and structured fields. Instructions
guide behavior; execution permissions require enforcement and cannot be replaced
by prompt instructions.

Core validates structure, references, files, and declared constraints. It does not
execute the definitions or prove that a model follows the instructions and produces
the expected result.

## Names and further reading

The repository calls its portable concepts `i-skill`, `i-command`, and `i-agent`
to distinguish them from similarly named features in other environments. YAML
`kind` values are `skill`, `command`, and `agent`; catalog keys use `kind/<id>`.
The public API calls a loaded catalog entry an `Asset`.

See [format and authoring](format.md) for files, schema v1 limits, and contract
extensions; [fields](fields.md) for field semantics; and [API](README.md) for loading
and consuming core. The skill model follows the terminology of
[Agent Skills](https://agentskills.io/what-are-skills).
