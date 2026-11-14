// Collects every Packagist package of type "sylius-plugin" with its releases and branches.
// Usage: node scripts/collect.mjs [data-dir]
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "data";
const UA = "sylius-2-plugin-readiness (+https://github.com/pierrearthurdemengel/sylius-2-plugin-readiness)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
      await sleep(1500 * (i + 1));
    } catch {
      await sleep(1500 * (i + 1));
    }
  }
  throw new Error("failed: " + url);
}

// Packagist p2 metadata is minified: each version inherits the fields of the previous one.
function expand(list) {
  const out = [];
  let prev = {};
  for (const v of list ?? []) {
    const cur = { ...prev };
    for (const [k, val] of Object.entries(v)) {
      if (val === "__unset") delete cur[k];
      else cur[k] = val;
    }
    out.push(cur);
    prev = cur;
  }
  return out;
}

// Packages released with the same numbering as sylius/sylius (the monorepo sub-packages).
const core = await get("https://repo.packagist.org/p2/sylius/sylius.json");
const coreVersions = expand(core.packages["sylius/sylius"]);
const v2 = coreVersions.find((v) => /^v?2\./.test(v.version));
writeFileSync(join(OUT, "monorepo.json"), JSON.stringify(["sylius/sylius", ...Object.keys(v2.replace ?? {})], null, 1));
writeFileSync(
  join(OUT, "sylius-versions.json"),
  JSON.stringify(coreVersions.filter((v) => !/(alpha|beta|rc|dev)/i.test(v.version)).map((v) => ({ version: v.version, time: v.time }))),
);

const names = (await get("https://packagist.org/packages/list.json?type=sylius-plugin")).packageNames;
console.log(names.length, "packages");

const raw = {};
let i = 0;
async function worker() {
  while (i < names.length) {
    const name = names[i++];
    const [stable, dev, info] = await Promise.all([
      get(`https://repo.packagist.org/p2/${name}.json`),
      get(`https://repo.packagist.org/p2/${name}~dev.json`),
      get(`https://packagist.org/packages/${name}.json`),
    ]);
    const pick = (v) => ({ version: v.version, time: v.time, require: v.require ?? {} });
    raw[name] = {
      description: info?.package?.description ?? "",
      tagged: expand(stable?.packages?.[name]).map(pick),
      dev: expand(dev?.packages?.[name]).map(pick),
      downloads: info?.package?.downloads ?? null,
      stars: info?.package?.github_stars ?? null,
      abandoned: info?.package?.abandoned ?? false,
      repository: info?.package?.repository ?? null,
    };
    if (i % 100 === 0) console.log(i);
    await sleep(150);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
writeFileSync(join(OUT, "raw.json"), JSON.stringify(raw));
console.log("done:", Object.keys(raw).length);
