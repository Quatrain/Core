#!/usr/bin/env node
/**
 * Generates one CycloneDX SBOM per workspace package (production closure only).
 *
 *   node bin/sbom.js --out <dir>
 *       every package
 *   node bin/sbom.js --out <dir> --plan <plan.json>
 *       only the packages listed by `publish_all.js --plan` (pre-publish gate)
 *   node bin/sbom.js --out <dir> --manifest <published.json>
 *       only the packages listed by `publish_all.js --manifest` (release evidence):
 *       the SBOM carries the digests of the published tarball, and
 *       <dir>/index.json lists what was generated (consumed by the attest job)
 *
 * The SBOM describes the dependency resolution of this repository (yarn.lock)
 * at build time. Consumers resolve the published semver ranges themselves, so
 * it is declared with lifecycle phase "build".
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.join(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');
const SPEC_VERSION = '1.6';

function arg(name) {
    const i = process.argv.indexOf(name);
    return i !== -1 ? process.argv[i + 1] : undefined;
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// "Name <email>" (package.json author) -> CycloneDX organizationalEntity
function supplierFromAuthor(author) {
    const raw = typeof author === 'string' ? author : author && author.name;
    if (!raw) return undefined;
    const m = raw.match(/^([^<(]+?)\s*(?:<([^>]+)>)?\s*(?:\(.*\))?$/);
    if (!m) return { name: raw };
    const email = m[2] || (typeof author === 'object' ? author.email : undefined);
    return email ? { name: m[1], contact: [{ email }] } : { name: m[1] };
}

function allPackages() {
    return fs.readdirSync(packagesDir)
        .map(item => path.join(packagesDir, item))
        .filter(dir => fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'package.json')))
        .map(dir => ({ dir: path.relative(rootDir, dir) }));
}

// Yarn reports sibling workspaces with the version it saw at install time. After a release
// bump that is stale, so re-read each one from its package.json (bom-ref: "<name>@workspace:<dir>").
function refreshWorkspaceVersions(bom) {
    for (const component of bom.components || []) {
        const m = /@workspace:(.+)$/.exec(component['bom-ref'] || '');
        if (!m) continue;
        const { version } = readJson(path.join(rootDir, m[1], 'package.json'));
        if (component.version === version) continue;
        if (component.purl) component.purl = component.purl.replace(`@${component.version}`, `@${version}`);
        component.version = version;
    }
}

function generate(pkgDir, outFile, cli) {
    const res = spawnSync(process.execPath, [
        cli,
        '--production',
        '--mc-type', 'library',
        '--spec-version', SPEC_VERSION,
        '--output-format', 'JSON',
        '--output-file', outFile,
    ], { cwd: pkgDir, encoding: 'utf8' });
    if (res.error) throw res.error;
    if (res.status !== 0) {
        throw new Error(`yarn cyclonedx failed in ${pkgDir}\n${res.stdout || ''}${res.stderr || ''}`);
    }
}

function main() {
    const outArg = arg('--out');
    if (!outArg) {
        console.error('Usage: node bin/sbom.js --out <dir> [--plan <plan.json> | --manifest <published.json>]');
        process.exit(2);
    }
    const outDir = path.resolve(outArg);
    const planFile = arg('--plan');
    const manifestFile = arg('--manifest');
    const isRelease = Boolean(manifestFile);

    let entries;
    if (manifestFile) entries = readJson(manifestFile);
    else if (planFile) entries = readJson(planFile);
    else entries = allPackages();

    // Pinned through the root devDependencies / yarn.lock. This file is the plugin's supported CLI:
    // it runs `yarn cyclonedx` with the plugin loaded, without registering it in .yarnrc.yml.
    const cli = path.join(rootDir, 'node_modules', '@cyclonedx', 'yarn-plugin-cyclonedx', 'bin', 'cyclonedx-yarn-cli.js');
    if (!fs.existsSync(cli)) throw new Error(`${cli} not found, run "yarn install" first`);
    const supplier = supplierFromAuthor(readJson(path.join(rootDir, 'package.json')).author);

    fs.mkdirSync(outDir, { recursive: true });
    const index = [];

    for (const entry of entries) {
        const pkgDir = path.join(rootDir, entry.dir);
        const pkgJson = readJson(path.join(pkgDir, 'package.json'));

        // Release evidence must describe exactly what was published
        if (isRelease && entry.version !== pkgJson.version) {
            throw new Error(`${pkgJson.name}: manifest says ${entry.version}, package.json says ${pkgJson.version}`);
        }

        const fileName = `${pkgJson.name.replace(/^@/, '').replace(/\//g, '-')}-${pkgJson.version}.cdx.json`;
        const outFile = path.join(outDir, fileName);
        generate(pkgDir, outFile, cli);

        const bom = readJson(outFile);
        refreshWorkspaceVersions(bom);
        bom.metadata.lifecycles = [{ phase: 'build' }];
        if (supplier) {
            bom.metadata.supplier = supplier;
            bom.metadata.component.supplier = supplier;
        }
        if (isRelease && entry.sha256 && entry.sha512) {
            bom.metadata.component.hashes = [
                { alg: 'SHA-256', content: entry.sha256 },
                { alg: 'SHA-512', content: entry.sha512 },
            ];
        }
        fs.writeFileSync(outFile, JSON.stringify(bom, null, 2) + '\n', 'utf8');

        index.push({
            name: pkgJson.name,
            version: pkgJson.version,
            purl: bom.metadata.component.purl,
            sbom: fileName,
            components: (bom.components || []).length,
            ...(isRelease && entry.sha256 ? { sha256: entry.sha256 } : {}),
        });
        console.log(`[SBOM] ${pkgJson.name}@${pkgJson.version}: ${(bom.components || []).length} components -> ${fileName}`);
    }

    fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
    console.log(`[SBOM] ${index.length} SBOM(s) written to ${outDir}`);
}

try {
    main();
} catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
}
