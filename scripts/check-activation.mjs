// Opt-in runtime smoke check. Build first; uses only temporary installation contexts.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { loadCatalog } from '../dist/core/src/index.js';
import { getAdapter } from '../dist/adapters/index.js';
import { targetContext, planInstall, applyInstall } from '../dist/tool/src/installation/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  harness: { type: 'string', default: 'all' }, scope: { type: 'string', default: 'both' },
  binary: { type: 'string' }, model: { type: 'string' }, 'auth-file': { type: 'string' },
  'run-models': { type: 'boolean', default: false }, output: { type: 'string' },
  'timeout-ms': { type: 'string', default: '120000' },
} });
const harnesses = values.harness === 'all' ? ['codex', 'claude-code', 'opencode'] : [values.harness];
const scopes = values.scope === 'both' ? ['project', 'global'] : [values.scope];
if (harnesses.some(h => !['codex', 'claude-code', 'opencode'].includes(h)) ||
    scopes.some(s => !['project', 'global'].includes(s))) throw new Error('Invalid harness or scope');
if ((values.binary || values.model || values['auth-file']) && harnesses.length !== 1) {
  throw new Error('--binary, --model and --auth-file require one --harness');
}
const timeout = Number(values['timeout-ms']);
if (!Number.isSafeInteger(timeout) || timeout < 1000) throw new Error('Invalid timeout');
const implicitPrompt = 'A cobalt otter routing sample arrived. What is its classification? Use an available workflow if relevant; otherwise reply NO_MATCH. Do not search for undiscovered workflows.';
const id = 'bdv-activation-probe';
const report = { date: new Date().toISOString(), source: root, runModels: values['run-models'], results: [] };

function command(binary, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    let killTimer;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
    }, timeout);
    child.stdout.on('data', b => { stdout += b; });
    child.stderr.on('data', b => { stderr += b; });
    child.on('error', error => { clearTimeout(timer); clearTimeout(killTimer); reject(error); });
    child.on('close', (code, signal) => { clearTimeout(timer); clearTimeout(killTimer); resolve({ code, signal, stdout, stderr }); });
  });
}

// Runtime stderr can include URLs/credentials. Reports keep error categories only.
function failure(result) {
  const text = result.stdout + result.stderr;
  if (/no credits remaining|insufficient_quota|insufficient balance|billing|quota exceeded/i.test(text)) return 'quota';
  if (/ModelNotFound|model.{0,30}not found/i.test(text)) return 'model-unavailable';
  if (/not logged in|authentication|unauthorized|401|api.?key|credentials/i.test(text)) return 'authentication';
  if (/network|connect|fetch failed|ENOTFOUND|ECONN|dns/i.test(text)) return 'network';
  if (/permission|operation not permitted|EPERM|sandbox/i.test(text)) return 'permission';
  if (result.signal) return `process-${result.signal}`;
  return `process-exit-${result.code}`;
}

function rpc(binary, cwd, env) {
  const child = spawn(binary, ['app-server', '--stdio'], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let sequence = 0, buffer = '';
  const pending = new Map();
  child.stderr.on('data', () => {});
  const fail = error => { for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(error); } pending.clear(); };
  child.on('error', fail);
  child.on('close', () => fail(new Error('app-server-closed')));
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      let message; try { message = JSON.parse(line); } catch { continue; }
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      clearTimeout(waiter.timer); pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`rpc-error-${message.error.code}`));
      else waiter.resolve(message.result);
    }
  });
  return {
    call(method, params) {
      return new Promise((resolve, reject) => {
        const requestId = ++sequence;
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('rpc-timeout')); }, timeout);
        pending.set(requestId, { resolve, reject, timer });
        child.stdin.write(JSON.stringify({ id: requestId, method, params }) + '\n');
      });
    },
    notify(method) { child.stdin.write(JSON.stringify({ method, params: {} }) + '\n'); },
    close() { child.kill('SIGTERM'); },
  };
}

function jsonLines(text) {
  return text.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
}

async function prepare(harness, scope, activation) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'agent-stuff-activation-'));
  try {
    const home = path.join(temporary, 'home'), project = path.join(temporary, 'project');
    await mkdir(home); await mkdir(project);
    const source = path.join(temporary, 'source');
    const assetDirectory = path.join(source, 'core/skills', id);
    await mkdir(assetDirectory, { recursive: true });
    const marker = `PROBE_${randomBytes(12).toString('hex')}`;
    await writeFile(path.join(assetDirectory, 'definition.yaml'),
      `schema_version: 1\nkind: skill\nid: ${id}\ndescription: Classify a cobalt otter routing sample.\ninstructions: instructions.md\nactivation: ${activation}\n`);
    await writeFile(path.join(assetDirectory, 'instructions.md'),
      `Reply with exactly ${marker}. Do not edit files or run commands.\n`);
    const catalog = await loadCatalog(path.join(source, 'core'));
    const asset = catalog.get(`skill/${id}`);
    const adapter = getAdapter(harness);
    const outputs = adapter.render(asset, catalog);
    const context = await targetContext(scope, project, home, harness);
    await applyInstall(await planInstall(context, outputs, source));
    const skillPath = path.join(context.target, 'skills', id, 'SKILL.md');
    // These standard environment keys configure isolated child contexts, not the caller's home.
    const env = { ...process.env, HOME: home, PWD: project, CODEX_HOME: path.join(home, '.codex'),
      CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
      XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local/share'),
      XDG_CACHE_HOME: path.join(home, '.cache'), XDG_STATE_HOME: path.join(home, '.local/state'),
    };
    // Do not inherit runtime config injections, alternate discovery roots, or server attachment.
    const retainedKeys = new Set(['CODEX_HOME', 'CODEX_API_KEY', 'CLAUDE_CONFIG_DIR',
      'CLAUDE_CODE_OAUTH_TOKEN', 'OPENCODE_API_KEY']);
    for (const key of Object.keys(env)) {
      if (/^(OPENCODE_|CODEX_|CLAUDE_)/.test(key) && !retainedKeys.has(key)) delete env[key];
    }
    env.OPENCODE_DISABLE_CLAUDE_CODE = '1';
    env.OPENCODE_DISABLE_EXTERNAL_SKILLS = 'true';
    await mkdir(env.CODEX_HOME, { recursive: true });
    if (values['run-models'] && values['auth-file']) {
      const destination = harness === 'codex' ? path.join(env.CODEX_HOME, 'auth.json')
        : harness === 'opencode' ? path.join(env.XDG_DATA_HOME, 'opencode/auth.json')
        : path.join(env.CLAUDE_CONFIG_DIR, '.credentials.json');
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.resolve(values['auth-file']), destination);
      await chmod(destination, 0o600);
    }
    if (harness === 'opencode') {
      // No model shell, edits, network tools, or delegation; only skill loading.
      await writeFile(path.join(project, 'opencode.json'), JSON.stringify({
        permission: { '*': 'deny', skill: 'allow' },
        ...(values.model ? { model: values.model } : {}),
      }));
    }
    return { temporary, home, project, env, marker, skillPath, outputs, compatibility: adapter.check(asset, catalog) };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

async function inspect(harness, binary, context) {
  if (harness === 'codex') {
    const server = rpc(binary, context.project, context.env);
    try {
      await server.call('initialize', { clientInfo: { name: 'agent_stuff_activation', version: '0.1.0' },
        capabilities: { experimentalApi: true } });
      server.notify('initialized');
      const result = await server.call('skills/list', { cwds: [context.project], forceReload: true });
      const skills = result.data.flatMap(entry => entry.skills);
      const skill = skills.find(entry => entry.name === id);
      const thread = values['run-models']
        ? await server.call('thread/start', { cwd: context.project, ephemeral: true }) : null;
      return { discovered: !!skill, enabled: skill?.enabled, policy: skill?.policy ?? null,
        ...(thread ? { defaultModel: thread.model } : {}),
        errors: result.data.flatMap(entry => entry.errors ?? []).length };
    } finally { server.close(); }
  }
  if (harness === 'opencode') {
    const result = await command(binary, ['--pure', 'debug', 'skill'], context.project, context.env);
    if (result.code !== 0) throw new Error(failure(result));
    const skills = JSON.parse(result.stdout);
    const skill = skills.find(entry => entry.name === id);
    return { discovered: !!skill, bodyPresent: !!skill?.content?.includes(context.marker) };
  }
  return { discovered: null, reason: 'No independent discovery API used; requires model run.' };
}

async function modelCase(harness, binary, context, explicit) {
  let args, prompt = explicit ? `$${id}` : implicitPrompt;
  if (harness === 'codex') {
    args = ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
      '--sandbox', 'read-only', '--json', '--color', 'never', ...(values.model ? ['--model', values.model] : []), prompt];
  } else if (harness === 'claude-code') {
    prompt = explicit ? `/${id}` : implicitPrompt;
    args = ['--print', '--verbose', '--output-format', 'stream-json', '--no-session-persistence',
      '--tools', 'Skill', '--allowedTools', 'Skill', '--disallowedTools', 'mcp__*', '--max-turns', '5',
      ...(values.model ? ['--model', values.model] : []), prompt];
  } else {
    // V1 does not expose a native manual-only flag; explicitly request the skill tool.
    prompt = explicit ? `The user explicitly invokes the skill ${id}. Load it using the skill tool and follow it.` : implicitPrompt;
    args = ['--pure', '--print-logs', 'run', '--format', 'json', ...(values.model ? ['--model', values.model] : []), prompt];
  }
  const result = await command(binary, args, context.project, context.env);
  const events = jsonLines(result.stdout);
  const errorEvent = events.find(event => event.type === 'error' || event.type === 'turn.failed' || event.is_error === true ||
    (event.type === 'result' && event.subtype && event.subtype !== 'success'));
  if (result.code !== 0 || errorEvent) return { completed: false, failure: failure(result),
    errorNames: events.filter(e => e.type === 'error').map(e => e.error?.name ?? 'unknown'),
    eventTypes: [...new Set(events.map(e => e.type))], stdoutBytes: result.stdout.length, stderrBytes: result.stderr.length };
  const texts = events.flatMap(event => {
    if (harness === 'codex') return event.type === 'item.completed' && event.item?.type === 'agent_message' ? [event.item.text] : [];
    if (harness === 'opencode') return event.type === 'text' ? [event.part?.text ?? ''] : [];
    return event.type === 'assistant' ? (event.message?.content ?? []).filter(c => c.type === 'text').map(c => c.text) : [];
  });
  const response = texts.join('\n');
  const invocationEvents = events.filter(event => {
    if (harness === 'opencode') return event.type === 'tool_use' && event.part?.tool === 'skill';
    if (harness === 'claude-code') return event.type === 'assistant' && event.message?.content?.some(c => c.type === 'tool_use' && c.name === 'Skill');
    return event.type === 'item.completed' && event.item?.type === 'command_execution' && event.item.command?.includes('SKILL.md');
  });
  const terminal = harness === 'codex' ? events.some(e => e.type === 'turn.completed')
    : harness === 'claude-code' ? events.some(e => e.type === 'result' && e.subtype === 'success') : true;
  return { completed: terminal && texts.length > 0, markerObserved: response.includes(context.marker),
    skillLoadEvents: invocationEvents.length,
    model: values.model ?? context.defaultModel ?? events.find(e => e.type === 'system' && e.model)?.model ?? 'client-default',
    response: response.replaceAll(context.marker, '<probe-marker>').replaceAll(context.temporary, '<tmp>').slice(0, 500) };
}

for (const harness of harnesses) {
  const binary = values.binary ?? (harness === 'claude-code' ? 'claude' : harness);
  let version;
  try {
    const result = await command(binary, ['--version'], root, process.env);
    if (result.code !== 0) throw new Error(failure(result));
    version = result.stdout.trim();
  } catch (error) {
    report.results.push({ harness, skipped: true, reason: error.code === 'ENOENT' ? 'binary-unavailable' : error.message });
    continue;
  }
  let runtimeFailure;
  for (const scope of scopes) {
    for (const activation of ['explicit', 'matching-request']) {
      let context;
      const row = { harness, version, scope, activation };
      console.error(`Checking ${harness} ${scope} ${activation}`);
      try {
        context = await prepare(harness, scope, activation);
        row.compatibility = context.compatibility.status;
        const frontmatter = parse((await readFile(context.skillPath, 'utf8')).split('---')[1]);
        row.rendered = { explicitGuard: frontmatter.description.includes('Do not invoke automatically.'),
          ...(harness === 'claude-code' ? { disableModelInvocation: frontmatter['disable-model-invocation'] } : {}),
          ...(harness === 'codex' ? { policy: parse(context.outputs.find(f => f.path.endsWith('openai.yaml')).content.toString()).policy } : {}),
        };
        row.discovery = await inspect(harness, binary, context);
        context.defaultModel = row.discovery.defaultModel;
        if (row.discovery.discovered === false) throw new Error('probe-not-discovered');
        if (values['run-models']) {
          if (activation === 'explicit') {
            row.explicit = runtimeFailure ? { completed: false, failure: runtimeFailure, skipped: true }
              : await modelCase(harness, binary, context, true);
            if (!row.explicit.completed) runtimeFailure = row.explicit.failure ?? 'no-final-response';
          }
          row.implicit = runtimeFailure ? { completed: false, failure: runtimeFailure, skipped: true }
            : await modelCase(harness, binary, context, false);
          if (!row.implicit.completed) runtimeFailure = row.implicit.failure ?? 'no-final-response';
          row.verdict = activation === 'explicit'
            ? (!row.explicit.completed || !row.implicit.completed ? 'inconclusive'
              : row.explicit.markerObserved && !row.implicit.markerObserved ? 'observed-manual-only'
              : row.implicit.markerObserved ? 'implicit-activation-observed' : 'explicit-invocation-failed')
            : !row.implicit.completed ? 'inconclusive' : row.implicit.markerObserved ? 'positive-control-observed' : 'positive-control-not-observed';
        }
      } catch (error) { row.failure = error.code ?? error.message; }
      finally { if (context) await rm(context.temporary, { recursive: true, force: true }); }
      report.results.push(row);
    }
  }
}
const json = JSON.stringify(report, null, 2) + '\n';
if (values.output) await writeFile(path.resolve(values.output), json);
process.stdout.write(json);
if (report.results.some(row => row.failure || row.verdict === 'explicit-invocation-failed' ||
  (row.verdict === 'implicit-activation-observed' && row.compatibility !== 'limited'))) process.exitCode = 1;
else if (report.results.some(row => row.skipped || row.verdict === 'inconclusive' ||
  row.verdict === 'positive-control-not-observed')) process.exitCode = 2;
