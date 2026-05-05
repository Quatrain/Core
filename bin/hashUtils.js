const { hashElement } = require('folder-hash');
const crypto = require('crypto');

const hashOptions = {
    folders: { exclude: ['.*', 'node_modules', 'dist', 'lib'] },
    files: { include: ['*.js', '*.ts', '*.json', '*.md'], exclude: ['package.json', 'tsconfig.tsbuildinfo'] }
};

function getDepsHash(pkgJson) {
    return crypto.createHash('sha256').update(JSON.stringify({
        dependencies: pkgJson.dependencies || {},
        peerDependencies: pkgJson.peerDependencies || {},
        scripts: pkgJson.scripts || {},
        bin: pkgJson.bin || {}
    })).digest('hex');
}

async function computePackageHash(pkgDir, pkgJson) {
    const { hash: rawHash } = await hashElement(pkgDir, hashOptions);
    const depsHash = getDepsHash(pkgJson);
    return `${rawHash}-${depsHash}`;
}

module.exports = {
    hashOptions,
    getDepsHash,
    computePackageHash
};
