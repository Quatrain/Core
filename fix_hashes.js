const fs = require('fs');
const path = require('path');
const { hashElement } = require('folder-hash');
const crypto = require('crypto');

const packagesDir = path.join(__dirname, 'packages');
const registryFile = path.join(__dirname, '.version_hashes.json');
const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));

const hashOptions = {
    folders: { exclude: ['.*', 'node_modules', 'dist', 'lib'] },
    files: { include: ['*.js', '*.ts', '*.json', '*.md'], exclude: ['package.json', 'tsconfig.tsbuildinfo'] }
};

async function run() {
    const packages = fs.readdirSync(packagesDir);
    for(const pkg of packages) {
        const pkgDir = path.join(packagesDir, pkg);
        if (!fs.statSync(pkgDir).isDirectory()) continue;
        const pkgJsonPath = path.join(pkgDir, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) continue;
        
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const { hash: rawHash } = await hashElement(pkgDir, hashOptions);
        
        const depsHash = crypto.createHash('sha256').update(JSON.stringify({
            dependencies: pkgJson.dependencies || {},
            devDependencies: pkgJson.devDependencies || {},
            peerDependencies: pkgJson.peerDependencies || {},
            scripts: pkgJson.scripts || {},
            bin: pkgJson.bin || {}
        })).digest('hex');
        const finalHash = `${rawHash}-${depsHash}`;
        
        if (registry[pkgJson.name]) {
            registry[pkgJson.name].hash = finalHash;
        }
    }
    
    fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf8');
    console.log("Les hashes sont maintenant parfaitement synchronisés avec le nouvel algorithme !");
}

run().catch(console.error);
