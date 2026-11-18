/**
 * Tags every package released by a commit, one annotated tag per package:
 *
 *     @quatrain/<package>@<version>
 *
 * A package is released by a commit when the `version` of its package.json differs between
 * that commit and the base revision. Private packages and prerelease versions are skipped,
 * and a tag that already exists is left alone, so the script can run twice.
 *
 * Usage: node bin/tag_released_packages.js [--base <rev>] [--head <rev>] [--dry-run] [--push]
 *
 *   --base <rev>   revision to compare with (default: the parent of --head)
 *   --head <rev>   release commit, which receives the tags (default: HEAD)
 *   --dry-run      print the tags without creating them
 *   --push         push the created tags to `origin`
 */
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.join(__dirname, '..');
const PACKAGES_DIRECTORY = 'packages';
const STABLE_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Runs git and returns its standard output, or null when the command fails and
 * `allowFailure` is set.
 */
function git(args, { allowFailure = false } = {}) {
    const result = spawnSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', shell: false });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        if (allowFailure) {
            return null;
        }
        throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
    }
    return result.stdout;
}

function readOption(name) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return undefined;
    }
    const value = process.argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
        throw new Error(`Option ${name} needs a value.`);
    }
    return value;
}

/** Reads a package.json at a revision; null when the file does not exist there. */
function readManifest(revision, manifestPath) {
    const content = git(['show', `${revision}:${manifestPath}`], { allowFailure: true });
    if (content === null) {
        return null;
    }
    return JSON.parse(content);
}

/** Lists the package.json files of the packages directory at a revision. */
function listManifests(revision) {
    return git(['ls-tree', '--name-only', `${revision}:${PACKAGES_DIRECTORY}`])
        .split('\n')
        .filter((entry) => entry.length > 0)
        .map((entry) => `${PACKAGES_DIRECTORY}/${entry}/package.json`);
}

/** Returns the tags owed by `head`: the packages whose stable version changed since `base`. */
function findReleasedPackages(base, head) {
    const released = [];
    for (const manifestPath of listManifests(head)) {
        const manifest = readManifest(head, manifestPath);
        if (manifest === null || manifest.private === true || !manifest.name || !manifest.version) {
            continue;
        }
        if (!STABLE_VERSION.test(manifest.version)) {
            continue;
        }
        const previous = readManifest(base, manifestPath);
        if (previous !== null && previous.version === manifest.version) {
            continue;
        }
        released.push({ name: manifest.name, version: manifest.version, tag: `${manifest.name}@${manifest.version}` });
    }
    return released;
}

function tagExists(tag) {
    return git(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], { allowFailure: true }) !== null;
}

function main() {
    const dryRun = process.argv.includes('--dry-run');
    const push = process.argv.includes('--push');
    const head = git(['rev-parse', '--verify', `${readOption('--head') || 'HEAD'}^{commit}`]).trim();
    const base = git(['rev-parse', '--verify', `${readOption('--base') || `${head}~1`}^{commit}`]).trim();

    const released = findReleasedPackages(base, head);
    if (released.length === 0) {
        console.log(`[TAG] No package version changed between ${base.slice(0, 8)} and ${head.slice(0, 8)}.`);
        return;
    }

    const created = [];
    for (const { tag } of released) {
        if (tagExists(tag)) {
            console.log(`[TAG] ${tag} already exists, left untouched.`);
            continue;
        }
        if (dryRun) {
            console.log(`[TAG] ${tag} would be created on ${head.slice(0, 8)}.`);
            continue;
        }
        git(['tag', '--annotate', tag, head, '--message', `Release ${tag}`]);
        console.log(`[TAG] ${tag} created on ${head.slice(0, 8)}.`);
        created.push(tag);
    }

    if (push && created.length > 0) {
        git(['push', '--no-verify', 'origin', ...created.map((tag) => `refs/tags/${tag}`)]);
        console.log(`[TAG] ${created.length} tag(s) pushed to origin.`);
    }
}

try {
    main();
} catch (error) {
    console.error(`[TAG] ${error.message}`);
    process.exit(1);
}
