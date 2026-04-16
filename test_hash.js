const fs = require('fs');
const crypto = require('crypto');
const pkgJsonPath = 'packages/storage/package.json';
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

const depsObj = {
    dependencies: pkgJson.dependencies || {},
    peerDependencies: pkgJson.peerDependencies || {},
    scripts: pkgJson.scripts || {},
    bin: pkgJson.bin || {}
};

const str = JSON.stringify(depsObj);
console.log('Stringified:', str);
console.log('depsHash:', crypto.createHash('sha256').update(str).digest('hex'));
