# Sylius 2 plugin readiness tracker

Is your Sylius plugin ready for Sylius 2? This repository tracks every public package of type `sylius-plugin` on Packagist and publishes its Sylius 2 status, refreshed every week:

**https://pierrearthurdemengel.github.io/sylius-2-plugin-readiness/**

Sylius 1.14 security support ends on 31 December 2026, and a shop can only upgrade once every plugin it uses has a compatible release.

## Statuses

| Status | Meaning |
|---|---|
| Ready for Sylius 2 | A stable release published after Sylius 2.0.0 accepts a Sylius 2 version and names it explicitly |
| Pre-release only | Only alpha, beta or RC releases accept Sylius 2 |
| Development branch only | No release accepts Sylius 2, but a branch does |
| Replaced by another package | The author states in the README that Sylius 2 support lives in another package |
| Deprecated, no successor | The author states the plugin is no longer maintained, with no open-source equivalent |
| Sylius 1 only | No release or branch accepts Sylius 2 |

Only constraints on packages that follow Sylius numbering count (`sylius/sylius` and the sub-packages it replaces). An open-ended constraint such as `>=1.9` accepts Sylius 2 by accident and is not counted. The method is described in detail in the study this tracker comes from: [doi.org/10.5281/zenodo.24224419](https://doi.org/10.5281/zenodo.24224419).

## Found a mistake?

Replacements and deprecations come from the authors' own statements and are listed in [`data/overrides.json`](data/overrides.json). If a plugin is misclassified, or if its README announces a successor, please open an issue or a pull request with a link to the statement.

## Run it locally

Node.js 20 or later, no dependency:

```bash
node scripts/collect.mjs data   # about 2,400 requests to Packagist
node scripts/analyze.mjs data
node scripts/build.mjs          # writes the site to docs/
```

## Check your own project

[Sylius Upgrade Analyzer](https://github.com/pierrearthurdemengel/sylius-upgrade-analyzer) checks each plugin of a project along with the rest of the Sylius 2 breaking changes.

## Licence

Code under the MIT licence, data (`data/` and the published pages) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Maintained by Pierre-Arthur Demengel, Symfony and Sylius developer.
