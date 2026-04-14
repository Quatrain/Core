const { hashElement } = require('folder-hash');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pkgDir = path.join(__dirname, 'packages/auth');
const pkgJsonPath = path.join(pkgDir, 'package.json');
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
const hashOptions = {
    folders: { exclude: ['.*', 'node_modules', 'dist', 'lib'] },
    files: { include: ['*.js', '*.ts', '*.json', '*.md'], exclude: ['package.json', 'tsconfig.tsbuildinfo'] }
};
hashElement(pkgDir, hashOptions).then(({hash: rawHash}) => {
    const depsHash = crypto.createHash('sha256').update(JSON.stringify({
        dependencies: pkgJson.dependencies || {},
        devDependencies: pkgJson.devDependencies || {},
        peerDependencies: pkgJson.peerDependencies || {},
        scripts: pkgJson.scripts || {},
        bin: pkgJson.bin || {}
    })).digest('hex');
    console.log(`${rawHash}-${depsHash}`);
});
