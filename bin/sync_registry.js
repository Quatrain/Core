const fs = require('fs');
const path = require('path');
const { hashElement } = require('folder-hash');

const packagesDir = path.join(__dirname, '../packages');
const registryFile = path.join(__dirname, '../.version_hashes.json');

if (!fs.existsSync(registryFile)) {
    console.error(`Registry file not found at ${registryFile}`);
    process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));

async function syncRegistry() {
    const packages = fs.readdirSync(packagesDir);
    let changed = false;

    console.log('[SYNC] Recalculating hashes based on the new logic (excluding devDependencies)...');

    for (const pkg of packages) {
        const pkgDir = path.join(packagesDir, pkg);
        if (!fs.statSync(pkgDir).isDirectory()) continue;
        
        const pkgJsonPath = path.join(pkgDir, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) continue;
        
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const pkgName = pkgJson.name;

        // Same options as publish_all.js
        const hashOptions = {
            folders: { exclude: ['.*', 'node_modules', 'dist', 'lib'] },
            files: { include: ['*.js', '*.ts', '*.json', '*.md'], exclude: ['package.json', 'tsconfig.tsbuildinfo'] }
        };

        const { hash: rawHash } = await hashElement(pkgDir, hashOptions);
        
        // NEW Hashing logic (excluding devDependencies)
        const depsHash = require('crypto').createHash('sha256').update(JSON.stringify({
            dependencies: pkgJson.dependencies || {},
            peerDependencies: pkgJson.peerDependencies || {},
            scripts: pkgJson.scripts || {},
            bin: pkgJson.bin || {}
        })).digest('hex');

        const newHash = `${rawHash}-${depsHash}`;

        if (registry[pkgName]) {
            if (registry[pkgName].hash !== newHash) {
                console.log(`[SYNC] Updating hash for ${pkgName} in registry (Old: ${registry[pkgName].hash.slice(-8)} -> New: ${newHash.slice(-8)})`);
                registry[pkgName].hash = newHash;
                changed = true;
            } else {
                console.log(`[SKIP] Hash for ${pkgName} is already up to date.`);
            }
        } else {
            console.warn(`[WARNING] ${pkgName} not found in registry. Skipping...`);
        }
    }

    if (changed) {
        fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf8');
        console.log(`[DONE] ${registryFile} has been synchronized with the new hashing logic.`);
    } else {
        console.log('[DONE] No registry updates needed.');
    }
}

syncRegistry().catch(err => {
    console.error('[ERROR] Sync failed:', err);
    process.exit(1);
});
