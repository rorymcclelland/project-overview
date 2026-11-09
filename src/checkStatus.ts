// Checks a project status record (schema/status.v1.json) and explains any problem
// in plain English. The overview shows only records that pass (project rule 1).
// Field-by-field guide: docs/status-record.md.
import { Ajv, type ErrorObject } from 'ajv';
import schema from '../schema/status.v1.json' with { type: 'json' };

/** Records are a few kilobytes; anything near this size is a mistake or an attack. */
export const MAX_RECORD_BYTES = 1_000_000;
/** Allowed clock difference between the writing session and the checker. */
const CLOCK_SKEW_MS = 10 * 60 * 1000;
export const STAGES: readonly string[] = schema.properties.sprint.properties.stage.enum;

export interface CheckResult {
  ok: boolean;
  /** Problems that stop the record being shown. */
  errors: string[];
  /** Things the page must handle with care, such as markup to show as plain text. */
  warnings: string[];
}

const ajv = new Ajv({ allErrors: true, strict: true });
ajv.addFormat('date', {
  validate: (s: string) => isRealDate(s),
});
ajv.addFormat('date-time', {
  validate: (s: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s) &&
    isRealDate(s.slice(0, 10)) && !Number.isNaN(Date.parse(s)),
});
const validate = ajv.compile(schema);

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "/waiting/0/text" becomes "waiting[0].text". */
function fieldName(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((p, i) => (/^\d+$/.test(p) ? `[${p}]` : i === 0 ? p : `.${p}`))
    .join('');
}

function explain(e: ErrorObject, record: unknown): string {
  const at = fieldName(e.instancePath);
  const where = at || 'the record';
  switch (e.keyword) {
    case 'required': {
      const missing = (e.params as { missingProperty: string }).missingProperty;
      return `${at ? `${at}.` : ''}${missing} is missing.`;
    }
    case 'additionalProperties': {
      const extra = (e.params as { additionalProperty: string }).additionalProperty;
      return `${at ? `${at}.` : ''}${extra} is not a field of a version 1 record; remove it or check its spelling.`;
    }
    case 'enum': {
      const allowed = (e.params as { allowedValues: unknown[] }).allowedValues.join(', ');
      return `${where} is "${String(valueAt(record, e.instancePath))}", which is not allowed. Use one of: ${allowed}.`;
    }
    case 'const':
      return `version must be 1.`;
    case 'format':
      return `${where} is not a real ${e.params.format === 'date' ? 'date (YYYY-MM-DD)' : 'date and time (ISO 8601, with a time zone)'}.`;
    case 'pattern':
      if (e.instancePath.startsWith('/links/')) return `${where} must be an https:// link.`;
      return `${where} is empty or not in the expected form.`;
    case 'minLength':
      return `${where} is empty.`;
    case 'maxLength':
    case 'maxItems':
      return `${where} is too long.`;
    case 'type':
      return `${where} should be ${e.params.type === 'integer' ? 'a whole number' : `a ${e.params.type}`}.`;
    default:
      return `${where}: ${e.message ?? 'is not valid'}.`;
  }
}

function valueAt(record: unknown, path: string): unknown {
  let v: unknown = record;
  for (const p of path.split('/').filter(Boolean)) v = (v as Record<string, unknown>)?.[p];
  return v;
}

const MARKUP = /<[a-z!/][^>]*>|javascript:|on[a-z]+\s*=/i;

function collectText(v: unknown, path: string, out: [string, string][]): void {
  if (typeof v === 'string') out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => collectText(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) collectText(x, path ? `${path}.${k}` : k, out);
}

/**
 * Check a status record given as the text of its JSON file.
 * `now` is passed in so the date rules can be tested.
 */
export function checkRecord(text: string, options: { now?: Date } = {}): CheckResult {
  const now = options.now ?? new Date();
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (msg: string): CheckResult => ({ ok: false, errors: [msg], warnings: [] });

  if (Buffer.byteLength(text, 'utf8') > MAX_RECORD_BYTES)
    return fail(`The record is too large (over ${MAX_RECORD_BYTES / 1_000_000} MB). A real record is a few kilobytes.`);

  let record: unknown;
  try {
    record = JSON.parse(text);
  } catch {
    return fail('The record is not valid JSON.');
  }
  if (!record || typeof record !== 'object' || Array.isArray(record))
    return fail('The record must be a JSON object.');
  const rec = record as Record<string, unknown>;
  if (Object.hasOwn(rec, '__proto__')) return fail('The record contains a "__proto__" field, which is not allowed.');

  if (rec.version !== 1)
    return fail(
      rec.version === undefined
        ? 'version is missing. This checker reads version 1 records.'
        : `version is ${JSON.stringify(rec.version)}; this checker reads version 1 records only.`,
    );

  if (!validate(rec)) {
    for (const e of validate.errors ?? []) {
      const msg = explain(e, rec);
      if (!errors.includes(msg)) errors.push(msg);
    }
  }

  // Rules the schema cannot express.
  const project = rec.project as { kind?: string } | undefined;
  if (project?.kind === 'sprint' && rec.sprint === undefined)
    errors.push('sprint is missing: a sprint project must say which sprint it is in.');
  if (project?.kind === 'kanban' && rec.sprint !== undefined)
    errors.push('sprint must not be given for a kanban project, which has no sprints.');
  if (project?.kind === 'kanban' && rec.history !== undefined)
    errors.push('history must not be given for a kanban project, which has no sprints.');

  const written = typeof rec.writtenAt === 'string' ? Date.parse(rec.writtenAt) : NaN;
  if (!Number.isNaN(written)) {
    if (written > now.getTime() + CLOCK_SKEW_MS) errors.push(`writtenAt (${String(rec.writtenAt)}) is in the future.`);
    const writtenDay = new Date(written).toISOString().slice(0, 10);
    const notAfterWritten = (field: string, day: unknown) => {
      if (typeof day === 'string' && isRealDate(day) && day > writtenDay)
        errors.push(`${field} (${day}) is after the record was written (${writtenDay}).`);
    };
    notAfterWritten('lastActivity', rec.lastActivity);
    const sprint = rec.sprint as { stageSince?: unknown } | undefined;
    notAfterWritten('sprint.stageSince', sprint?.stageSince);
    (Array.isArray(rec.waiting) ? rec.waiting : []).forEach((w: { askedOn?: unknown }, i: number) =>
      notAfterWritten(`waiting[${i}].askedOn`, w?.askedOn),
    );
    (Array.isArray(rec.history) ? rec.history : []).forEach((h: { refined?: unknown; closed?: unknown }, i: number) => {
      notAfterWritten(`history[${i}].refined`, h?.refined);
      notAfterWritten(`history[${i}].closed`, h?.closed);
    });
  }

  (Array.isArray(rec.history) ? rec.history : []).forEach(
    (h: { planned?: unknown; done?: unknown; returned?: unknown }, i: number) => {
      if (typeof h?.planned === 'number' && typeof h.done === 'number' && typeof h.returned === 'number' &&
          h.done + h.returned > h.planned)
        errors.push(`history[${i}]: done (${h.done}) and returned (${h.returned}) add up to more than planned (${h.planned}).`);
    },
  );

  const texts: [string, string][] = [];
  collectText(rec, '', texts);
  for (const [path, value] of texts)
    if (MARKUP.test(value)) warnings.push(`${path} contains markup; the page must show it as plain text, never run it.`);

  return { ok: errors.length === 0, errors, warnings };
}
