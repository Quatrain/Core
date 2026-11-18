const RUNTIME_DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies'];

/**
 * Orders workspace packages so that each one comes after the workspace packages it depends on.
 *
 * A package is packed with the current version of its dependencies: releasing dependencies
 * first is what makes a release declare the versions published in the same run.
 * Only runtime dependencies count; development dependencies never reach a consumer.
 * Packages that do not depend on each other keep the alphabetical order of their names.
 *
 * @param {{ name: string, manifest: object }[]} packages workspace packages with their package.json
 * @returns {{ name: string, manifest: object }[]} the same packages, dependencies first
 * @throws {Error} when runtime dependencies form a cycle
 */
function sortByDependencies(packages) {
    const byPackageName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));
    const pending = new Map();
    for (const pkg of packages) {
        const dependencies = new Set();
        for (const field of RUNTIME_DEPENDENCY_FIELDS) {
            for (const dependency of Object.keys(pkg.manifest[field] || {})) {
                if (byPackageName.has(dependency) && dependency !== pkg.manifest.name) {
                    dependencies.add(dependency);
                }
            }
        }
        pending.set(pkg.manifest.name, dependencies);
    }

    const ordered = [];
    while (pending.size > 0) {
        const ready = [...pending.keys()].filter((name) => pending.get(name).size === 0).sort();
        if (ready.length === 0) {
            throw new Error(`Dependency cycle between workspace packages: ${[...pending.keys()].sort().join(', ')}`);
        }
        for (const name of ready) {
            ordered.push(byPackageName.get(name));
            pending.delete(name);
        }
        for (const dependencies of pending.values()) {
            for (const name of ready) {
                dependencies.delete(name);
            }
        }
    }
    return ordered;
}

/** True for a version carrying a prerelease identifier, such as `1.2.3-beta.0`. */
function isPrerelease(version) {
    return /^\d+\.\d+\.\d+-/.test(version);
}

module.exports = { sortByDependencies, isPrerelease };
