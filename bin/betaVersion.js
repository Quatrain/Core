const BETA_VERSION = /^(\d+\.\d+\.\d+)-beta\.(\d+)$/;

/**
 * Returns the beta version to publish: `candidate` when it is free, otherwise the next free
 * beta counter of the same base version.
 *
 * A candidate can already be published when an earlier run released it and its version bump
 * never reached the repository. Publishing must then move on, never skip the changed code.
 *
 * @param {string} candidate beta version computed from the repository (`X.Y.Z-beta.N`)
 * @param {string[]} publishedVersions every version of the package known to the registry
 * @returns {string} `candidate`, or `X.Y.Z-beta.(highest published counter + 1)`
 */
function nextFreeBetaVersion(candidate, publishedVersions) {
    const match = candidate.match(BETA_VERSION);
    if (!match) {
        throw new Error(`Not a beta version: ${candidate}`);
    }
    if (!publishedVersions.includes(candidate)) {
        return candidate;
    }
    const base = match[1];
    let highest = Number(match[2]);
    for (const version of publishedVersions) {
        const published = version.match(BETA_VERSION);
        if (published && published[1] === base && Number(published[2]) > highest) {
            highest = Number(published[2]);
        }
    }
    return `${base}-beta.${highest + 1}`;
}

module.exports = { nextFreeBetaVersion };
