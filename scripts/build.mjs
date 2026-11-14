// Builds the static site in docs/ from data/plugins.json and data/summary.json.
// Usage: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";

const BASE = "https://pierrearthurdemengel.github.io/sylius-2-plugin-readiness";
const STUDY = "https://doi.org/10.5281/zenodo.24224419";
const ANALYZER = "https://github.com/pierrearthurdemengel/sylius-upgrade-analyzer";
const HELP = "https://creation-site-pro.fr/en/sylius-2-upgrade?utm_source=github-readiness";
const OUT = "docs";

const rows = JSON.parse(readFileSync("data/plugins.json", "utf8")).filter((r) => r.status !== "undetermined");
const s = JSON.parse(readFileSync("data/summary.json", "utf8"));

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n) => Number(n).toLocaleString("en-US");
const date = (d) => (d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "never");
const plugUrl = (name) => `/plugins/${name}/`;

const LABEL = {
  ready: "Ready for Sylius 2",
  prerelease: "Pre-release only",
  branch: "Development branch only",
  replaced: "Replaced by another package",
  deprecated: "Deprecated, no successor",
  "v1-only": "Sylius 1 only",
};

function answer(r) {
  const n = `<code>${esc(r.name)}</code>`;
  switch (r.status) {
    case "ready":
      return `Yes. ${n} has a stable release compatible with Sylius 2: <strong>${esc(r.compatible.version)}</strong>, published on ${date(r.compatible.date)}, which requires <code>${esc(r.compatible.requires)}</code>.`;
    case "prerelease":
      return `Only as a pre-release. ${n} ${esc(r.compatible.version)} (${date(r.compatible.date)}) accepts Sylius 2 with <code>${esc(r.compatible.requires)}</code>, but no stable release does yet.`;
    case "branch":
      return `Not in a release yet. Only the development branch <code>${esc(r.branch.name)}</code> of ${n} accepts Sylius 2 (<code>${esc(r.branch.requires)}</code>); no tagged release does.`;
    case "replaced":
      return `Not under this name. The author states that Sylius 2 support is provided by ${r.successor.to ? `<a href="${BASE}${plugUrl(r.successor.to)}"><code>${esc(r.successor.to)}</code></a>` : esc(r.successor.label)}, so upgrading means switching packages.`;
    case "deprecated":
      return `No. ${n} is deprecated and has no open-source successor, so the feature has to be replaced or rebuilt before moving to Sylius 2.`;
    default:
      return `No. As of ${date(s.generatedAt)}, no release or branch of ${n} accepts Sylius 2.${r.latest ? ` The latest release, ${esc(r.latest.version)} (${date(r.latest.date)}), requires <code>${esc(r.latest.requires)}</code>.` : ""}`;
  }
}

function advice(r) {
  switch (r.status) {
    case "ready":
      return `<p>Update the constraint in your <code>composer.json</code> to the compatible line, then check the plugin's changelog: a major version change often means renamed services, new configuration or Twig hooks instead of template overrides.</p>`;
    case "prerelease":
      return `<p>You can test the pre-release on a branch, but avoid shipping it to production without pinning the exact version and reading its changelog. Watch the repository for the first stable tag.</p>`;
    case "branch":
      return `<p>Work is in progress but unreleased. Options: wait for a tag, require the branch temporarily (pinned to a commit), help the maintainer finish it, or replace the plugin.</p>`;
    case "replaced":
      return `<p>Plan a package switch, not a version bump: the replacement has its own service names, configuration and sometimes its own data model. Budget a data migration if the plugin stores data.</p>`;
    case "deprecated":
      return `<p>List what the plugin does for your shop today, then decide between a maintained alternative, a custom implementation, or dropping the feature. This is usually the first blocker to resolve.</p>`;
    default:
      return `<p>${r.latest && r.latest.date < "2024-01-01" ? "The plugin has had no release since " + date(r.latest.date) + ", so a Sylius 2 version is unlikely. " : ""}Options: ask the maintainer, contribute the port, replace it with a maintained plugin, or move the feature into your own code.</p>`;
  }
}

const CSS = `:root{--bg:#fbfaf8;--fg:#1d1b18;--mut:#6b645b;--line:#e4dfd7;--acc:#8a5a24;--ok:#1f7a4d;--warn:#9a6a00;--bad:#a33b2b;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141210;--fg:#efe9e1;--mut:#a39a8f;--line:#2e2924;--acc:#d39b5c;--ok:#5cc28f;--warn:#e0b04a;--bad:#e27a68;--card:#1c1916}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main,header,footer{max-width:960px;margin:0 auto;padding:0 16px}header{padding-top:28px}header a{color:var(--mut);text-decoration:none;font-size:14px}
h1{font-size:clamp(26px,4vw,38px);line-height:1.2;margin:18px 0 12px}h2{font-size:21px;margin:32px 0 10px}
a{color:var(--acc)}code{font:0.88em ui-monospace,Consolas,monospace;background:var(--card);border:1px solid var(--line);padding:1px 5px;border-radius:4px;word-break:break-word}
.lead{font-size:18px}.badge{display:inline-block;font-size:13px;font-weight:600;padding:3px 10px;border-radius:99px;border:1px solid currentColor}
.ready{color:var(--ok)}.prerelease,.branch{color:var(--warn)}.replaced,.deprecated,.v1-only{color:var(--bad)}
table{width:100%;border-collapse:collapse;font-size:15px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mut);font-weight:500}
td{overflow-wrap:anywhere}td code,td a{word-break:break-all}.facts{table-layout:fixed}.facts th{width:34%}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0}.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}.stat b{display:block;font-size:28px}
.box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:24px 0}input[type=search]{width:100%;padding:10px 12px;font-size:16px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg)}
.scroll{overflow-x:auto}footer{color:var(--mut);font-size:14px;padding-top:24px;padding-bottom:40px;border-top:1px solid var(--line);margin-top:40px}
pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;overflow-x:auto}`;

function page({ path, title, description, body, jsonld }) {
  const url = BASE + path;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:type" content="website">
<style>${CSS}</style>${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}</head>
<body><header><a href="${BASE}/">Sylius 2 plugin readiness tracker</a></header><main>${body}</main>
<footer><p>Data from Packagist, refreshed every week (last update: ${date(s.generatedAt)}). Method and full dataset: <a href="${STUDY}">study on Zenodo</a> · <a href="https://github.com/pierrearthurdemengel/sylius-2-plugin-readiness">source code</a>.</p>
<p>Maintained by Pierre-Arthur Demengel, Symfony and Sylius developer, author of <a href="${ANALYZER}">Sylius Upgrade Analyzer</a>. Spotted a mistake? <a href="https://github.com/pierrearthurdemengel/sylius-2-plugin-readiness/issues">Open an issue</a>.</p></footer></body></html>`;
  const file = join(OUT, path, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  return url;
}

const cta = `<div class="box"><h2 style="margin-top:0">Check your whole project</h2><p>A shop can only upgrade once every plugin is ready. <a href="${ANALYZER}">Sylius Upgrade Analyzer</a> (open source, MIT) checks each plugin in your <code>composer.json</code> along with the rest of the breaking changes, whatever PHP version your project runs:</p><pre><code>docker run --rm -v "$PWD:/project" ghcr.io/pierrearthurdemengel/sylius-upgrade-analyzer</code></pre><p>Planning the upgrade before Sylius 1.14 security support ends on 31 December 2026? <a href="${HELP}">I offer a free migration assessment</a>.</p></div>`;

rmSync(OUT, { recursive: true, force: true });
const urls = [];

// Plugin pages
for (const r of rows) {
  const facts = [
    ["Status", `<span class="badge ${r.status}">${LABEL[r.status]}</span>`],
    ["Description", esc(r.description) || "—"],
    ["Latest stable release", r.latest ? `${esc(r.latest.version)} (${date(r.latest.date)})` : "none"],
    ["Its Sylius requirement", r.latest?.requires ? `<code>${esc(r.latest.requires)}</code>` : "—"],
    r.compatible && ["Sylius 2 compatible release", `${esc(r.compatible.version)} (${date(r.compatible.date)})`],
    r.firstV2 && ["First Sylius 2 release", date(r.firstV2)],
    r.branch && r.status !== "ready" && ["Sylius 2 branch", `<code>${esc(r.branch.name)}</code>`],
    r.successor && ["Replaced by", r.successor.to ? `<a href="${BASE}${plugUrl(r.successor.to)}"><code>${esc(r.successor.to)}</code></a>` : esc(r.successor.label)],
    (r.successor || r.deprecation) && ["Source", esc(r.successor?.source ?? r.deprecation)],
    ["Marked abandoned on Packagist", r.abandoned ? "yes" : "no"],
    ["Downloads", `${num(r.monthly)} per month, ${num(r.total)} in total`],
    r.repository && ["Repository", `<a href="${esc(r.repository)}" rel="nofollow">${esc(r.repository.replace(/^https?:\/\//, ""))}</a>`],
    ["Packagist", `<a href="https://packagist.org/packages/${esc(r.name)}" rel="nofollow">packagist.org/packages/${esc(r.name)}</a>`],
  ].filter(Boolean);
  const plain = answer(r).replace(/<[^>]+>/g, "");
  urls.push(
    page({
      path: plugUrl(r.name),
      title: `Is ${r.name} compatible with Sylius 2?`,
      description: plain.slice(0, 155),
      body: `<h1>Is <code>${esc(r.name)}</code> compatible with Sylius 2?</h1><p class="lead">${answer(r)}</p>
<h2>Facts</h2><div class="scroll"><table class="facts">${facts.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table></div>
<h2>What to do</h2>${advice(r)}${cta}
<p>Other plugins by <a href="${BASE}/vendors/${esc(r.vendor)}/">${esc(r.vendor)}</a> · <a href="${BASE}/">all ${num(rows.length)} plugins</a></p>`,
    }),
  );
}

// Vendor pages
const vendors = {};
for (const r of rows) (vendors[r.vendor] ??= []).push(r);
for (const [v, list] of Object.entries(vendors)) {
  const ready = list.filter((r) => r.status === "ready").length;
  urls.push(
    page({
      path: `/vendors/${v}/`,
      title: `${v} Sylius plugins: Sylius 2 compatibility`,
      description: `${ready} of ${list.length} Sylius plugins published by ${v} have a stable Sylius 2 release. Status of each plugin, updated weekly.`,
      body: `<h1>${esc(v)} Sylius plugins and Sylius 2</h1><p class="lead">${ready} of ${list.length} plugins published by <strong>${esc(v)}</strong> have a stable release compatible with Sylius 2.</p>
<div class="scroll"><table><tr><th>Plugin</th><th>Status</th><th>Latest release</th><th>Downloads / month</th></tr>${list
        .map((r) => `<tr><td><a href="${BASE}${plugUrl(r.name)}">${esc(r.name)}</a></td><td><span class="badge ${r.status}">${LABEL[r.status]}</span></td><td>${r.latest ? esc(r.latest.version) + " · " + esc(r.latest.date) : "—"}</td><td>${num(r.monthly)}</td></tr>`)
        .join("")}</table></div>${cta}`,
    }),
  );
}

// Home page
const b = s.byStatus;
const homeRows = rows
  .map((r) => `<tr data-q="${esc((r.name + " " + r.description).toLowerCase())}"><td><a href="${BASE}${plugUrl(r.name)}">${esc(r.name)}</a></td><td><span class="badge ${r.status}">${LABEL[r.status]}</span></td><td>${r.latest ? esc(r.latest.date) : "—"}</td><td>${num(r.monthly)}</td></tr>`)
  .join("");
urls.unshift(
  page({
    path: "/",
    title: "Sylius 2 plugin compatibility tracker",
    description: `Is your Sylius plugin ready for Sylius 2? Status of ${num(rows.length)} public plugins from Packagist, updated every week: ${s.activeReadyPct}% of active plugins have a stable Sylius 2 release.`,
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "Sylius 2 plugin compatibility",
      description: "Compatibility of every public Sylius plugin on Packagist with Sylius 2, derived from the version constraints of each release and refreshed weekly.",
      url: BASE + "/",
      license: "https://creativecommons.org/licenses/by/4.0/",
      creator: { "@type": "Person", name: "Pierre-Arthur Demengel" },
      dateModified: s.generatedAt,
      isBasedOn: STUDY,
    },
    body: `<h1>Is your Sylius plugin ready for Sylius 2?</h1>
<p class="lead">Sylius 1.14 security support ends on 31 December 2026, and a shop can only move to Sylius 2 once every plugin it uses has a compatible release. This page tracks all ${num(rows.length)} public Sylius plugins on Packagist, every week.</p>
<div class="stats"><div class="stat"><b>${s.activeReadyPct}%</b>of the ${num(s.active)} active plugins have a stable Sylius 2 release</div><div class="stat"><b>${s.readyDownloadPct}%</b>of monthly downloads go to ready plugins</div><div class="stat"><b>${num(b.ready)}</b>plugins ready, ${num(b["v1-only"])} still Sylius 1 only</div><div class="stat"><b>${num((b.replaced ?? 0) + (b.deprecated ?? 0))}</b>plugins replaced by another package or deprecated</div></div>
<p><label for="q">Find a plugin</label></p><input id="q" type="search" placeholder="e.g. stripe, wishlist, bitbag, mondial relay" autocomplete="off">
<div class="scroll"><table id="t"><tr><th>Plugin</th><th>Status</th><th>Latest release</th><th>Downloads / month</th></tr>${homeRows}</table></div>
<h2>How the status is decided</h2><p>Only constraints on packages that follow Sylius numbering count (<code>sylius/sylius</code> and its sub-packages). A plugin is <em>ready</em> when a stable release published after Sylius 2.0.0 accepts at least one Sylius 2 version and names Sylius 2 explicitly: an open-ended <code>&gt;=1.9</code> does not count. "Active" means a stable release since 1 January 2024 and not marked abandoned. Replacements and deprecations come from the authors' own README. Full method and dataset: <a href="${STUDY}">study on Zenodo</a>.</p>
${cta}<p>Plugins by publisher: ${Object.keys(vendors).sort().map((v) => `<a href="${BASE}/vendors/${esc(v)}/">${esc(v)}</a>`).join(" · ")}</p>
<script>const q=document.getElementById('q'),rs=[...document.querySelectorAll('#t tr[data-q]')];q.addEventListener('input',()=>{const v=q.value.toLowerCase().trim();for(const r of rs)r.style.display=!v||r.dataset.q.includes(v)?'':'none'})</script>`,
  }),
);

writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${s.generatedAt}</lastmod></url>`).join("\n")}\n</urlset>\n`);
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
writeFileSync(join(OUT, ".nojekyll"), "");
console.log(urls.length, "pages");
