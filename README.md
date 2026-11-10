# Parvenu on ClawHub (OpenClaw)

Two things are published to ClawHub under the `@ParvenuDev` account:

```
parvenu/              # SKILL: instructions the agent follows with curl
  SKILL.md
  scripts/parvenu.sh
plugin/               # PLUGIN: native typed tools (TypeScript -> dist/index.js)
  openclaw.plugin.json
  package.json
  src/index.ts
  dist/index.js       # built output; commit it
```

The skill calls the REST API directly with the user's own API key. It does not
go through the MCP server, so the enterprise-only billing tools (buy credits,
auto top-up) are not reachable from it.

## Publish

```bash
# run from this folder; npx avoids the global-install permission error
npx -y clawhub@latest login          # GitHub sign-in as ParvenuDev
npx -y clawhub@latest whoami
npx -y clawhub@latest skill publish ./parvenu --slug parvenu --name "Parvenu" \
  --changelog "Initial release" --dry-run
npx -y clawhub@latest skill publish ./parvenu --slug parvenu --name "Parvenu" \
  --changelog "Initial release"
```

Later versions: edit the files and run the publish command again with a new
`--changelog`; ClawHub bumps the patch version.

## Publish the plugin

ClawHub links every code-plugin release to a public GitHub commit, so push the
repo first (with `plugin/dist/` committed), then:

```bash
cd plugin
npm install --ignore-scripts && npm run build
npx openclaw plugins build && npx openclaw plugins validate   # needs Node >= 24.16
npx -y clawhub@latest package publish . --family code-plugin \
  --source-repo ParvenuDev/<repo> --source-commit <full commit sha> \
  --source-path plugin --changelog "Initial release" --dry-run
# same command without --dry-run to publish; add --wait to wait for the security checks
```

The release stays hidden from search and install until ClawHub's automated
checks pass. For a new version, bump `version` in both `package.json` and
`openclaw.plugin.json`, rebuild, commit, push, and publish with the new commit.

## Rules ClawHub enforces

- Every environment variable the files read must be declared in `SKILL.md`
  (`metadata.openclaw.requires.env`), or the security scan flags a metadata mismatch.
- Skills are published under MIT-0. No pricing metadata; credit costs are
  described in the instructions only.

## Test locally

```bash
export PARVENU_API_KEY=...     # your own key
./parvenu/scripts/parvenu.sh /credit_check
```
