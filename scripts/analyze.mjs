// Classifies every plugin by Sylius 2 compatibility, from the version constraints of its releases.
// Usage: node scripts/analyze.mjs [data-dir]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2] ?? "data";
const load = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const raw = load("raw.json");
const monorepo = new Set(load("monorepo.json"));
const released = load("sylius-versions.json");
const overrides = load("overrides.json");

// --- Composer constraints (the subset used by Sylius plugin requirements) ---
const parse = (v) => {
  const m = String(v).replace(/^v/i, "").replace(/[-@+].*$/, "").split(".");
  return [0, 1, 2].map((i) => (m[i] === undefined || m[i] === "*" || m[i] === "x" ? null : Number(m[i])));
};
const cmp = (a, b) => {
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
};
const splitTerms = (group) => group.replace(/@\w+/g, "").split(/\s*,\s*|\s+(?=[<>=!^~\dv*])/).filter(Boolean);
function term(t, ver) {
  t = t.trim();
  if (!t || t === "*") return true;
  if (/^dev-/.test(t)) return null;
  const m = t.match(/^(\^|~|>=|<=|>|<|!=|==|=)?\s*(.+)$/);
  const op = m[1] ?? "";
  const p = parse(m[2]);
  const nums = p.filter((n) => n !== null).length;
  if (op === "^") {
    const upper = p[0] > 0 || nums === 1 ? [p[0] + 1, 0, 0] : p[1] > 0 || nums === 2 ? [0, p[1] + 1, 0] : [0, 0, p[2] + 1];
    return cmp(ver, p) >= 0 && cmp(ver, upper) < 0;
  }
  if (op === "~") {
    const upper = nums <= 2 ? [p[0] + 1, 0, 0] : [p[0], p[1] + 1, 0];
    return cmp(ver, p) >= 0 && cmp(ver, upper) < 0;
  }
  if (op === ">=") return cmp(ver, p) >= 0;
  if (op === ">") return cmp(ver, p) > 0;
  if (op === "<=") return cmp(ver, p) <= 0;
  if (op === "<") return cmp(ver, p) < 0;
  if (op === "!=") return cmp(ver, p) !== 0;
  if (nums < 3 || /[*x]/.test(m[2])) {
    const upper = nums === 1 ? [p[0] + 1, 0, 0] : [p[0], (p[1] ?? 0) + 1, 0];
    return cmp(ver, p) >= 0 && cmp(ver, upper) < 0;
  }
  return cmp(ver, p) === 0;
}
function satisfies(constraint, version) {
  const ver = parse(version);
  return constraint.split(/\s*\|\|?\s*/).some((group) => {
    const res = splitTerms(group.replace(/(\S+)\s+-\s+(\S+)/g, ">=$1 <=$2")).map((t) => term(t, ver));
    return !res.some((r) => r === null) && res.every(Boolean);
  });
}
// An open-ended constraint such as ">=1.9" accepts Sylius 2 by accident: require one that names it.
function explicitV2(constraint) {
  return constraint.split(/\s*\|\|?\s*/).some((group) =>
    splitTerms(group).some((t) => {
      const m = t.trim().match(/^(\^|~|>=|<=|>|<|!=|==|=)?\s*(.+)$/);
      if (!m || /^dev-/.test(m[2])) return false;
      const op = m[1] ?? "";
      const p = parse(m[2]);
      if (op === "<" || op === "<=") return cmp(p, [2, 0, 0]) > 0;
      if (op === "!=") return false;
      return (p[0] ?? 0) >= 2;
    }),
  );
}
for (const [c, v, exp] of [["^1.12 || ^2.0", "2.1.0", true], ["^1.12", "2.0.0", false], [">=1.11 <2.0", "2.0.0", false], ["^2.1", "2.0.0", false], ["dev-main", "2.0.0", false], ["^1.13|^2.0", "2.2.0", true]])
  if (satisfies(c, v) !== exp) throw new Error(`constraint self-check failed: ${c} / ${v}`);
for (const [c, exp] of [[">=v1.9.0", false], [">=2.0 <2.4", true], [">=1.12 <3.0", true], [">=1.12 <2.0", false]])
  if (explicitV2(c) !== exp) throw new Error(`explicit self-check failed: ${c}`);

const V2 = released.filter((v) => /^v?2\./.test(v.version)).map((v) => v.version);
const V1 = released.filter((v) => /^v?1\./.test(v.version)).map((v) => v.version);
const V2_DATE = released.find((v) => /^v?2\.0\.0$/.test(v.version)).time;
const syliusReq = (req) => Object.entries(req).filter(([k]) => monorepo.has(k));
const reqText = (req) => syliusReq(req).map(([k, c]) => `${k} ${c}`).join(", ");
const allows = (req, targets) => {
  const r = syliusReq(req);
  return r.length > 0 && targets.some((t) => r.every(([, c]) => satisfies(c, t)));
};
const allowsV2 = (req) => allows(req, V2) && syliusReq(req).some(([, c]) => explicitV2(c));
const isPre = (v) => /(alpha|beta|rc|dev)/i.test(v);
const day = (t) => (t ? t.slice(0, 10) : null);

const rows = [];
for (const [name, p] of Object.entries(raw)) {
  const tagged = (p.tagged ?? []).filter((v) => v.time).sort((a, b) => (a.time < b.time ? 1 : -1));
  const dev = p.dev ?? [];
  const declares = [...tagged, ...dev].some((v) => syliusReq(v.require).length);
  const stableV2 = tagged.filter((v) => !isPre(v.version) && v.time >= V2_DATE && allowsV2(v.require));
  const preV2 = tagged.filter((v) => isPre(v.version) && v.time >= V2_DATE && allowsV2(v.require));
  const devV2 = dev.filter((v) => allowsV2(v.require));
  const latest = tagged.find((v) => !isPre(v.version)) ?? tagged[0] ?? null;
  let status;
  if (!declares) status = "undetermined";
  else if (stableV2.length) status = "ready";
  else if (overrides.successors[name]) status = "replaced";
  else if (overrides.deprecated[name]) status = "deprecated";
  else if (preV2.length) status = "prerelease";
  else if (devV2.length) status = "branch";
  else status = "v1-only";
  const compatible = stableV2[0] ?? preV2[0] ?? null;
  rows.push({
    name,
    vendor: name.split("/")[0],
    description: p.description,
    status,
    abandoned: p.abandoned,
    repository: p.repository,
    monthly: p.downloads?.monthly ?? 0,
    total: p.downloads?.total ?? 0,
    stars: p.stars ?? 0,
    latest: latest && { version: latest.version, date: day(latest.time), requires: reqText(latest.require), acceptsV1: allows(latest.require, V1) },
    compatible: compatible && { version: compatible.version, date: day(compatible.time), requires: reqText(compatible.require) },
    firstV2: day(stableV2.map((v) => v.time).sort()[0]),
    branch: devV2[0] && { name: devV2[0].version, requires: reqText(devV2[0].require) },
    successor: overrides.successors[name] ?? null,
    deprecation: overrides.deprecated[name] ?? null,
  });
}
rows.sort((a, b) => b.monthly - a.monthly || a.name.localeCompare(b.name));

const declared = rows.filter((r) => r.status !== "undetermined");
const active = declared.filter((r) => !r.abandoned && r.latest && r.latest.date >= "2024-01-01");
const count = (arr) => arr.reduce((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
const monthly = declared.reduce((s, r) => s + r.monthly, 0);
const readyMonthly = declared.filter((r) => r.status === "ready").reduce((s, r) => s + r.monthly, 0);
const summary = {
  generatedAt: new Date().toISOString().slice(0, 10),
  latestSylius: V2.slice().sort((a, b) => cmp(parse(b), parse(a)))[0],
  total: rows.length,
  declared: declared.length,
  byStatus: count(declared),
  active: active.length,
  activeByStatus: count(active),
  activeReadyPct: +((100 * active.filter((r) => r.status === "ready").length) / active.length).toFixed(1),
  readyDownloadPct: +((100 * readyMonthly) / monthly).toFixed(1),
};
writeFileSync(join(DIR, "plugins.json"), JSON.stringify(rows, null, 1));
writeFileSync(join(DIR, "summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary));
