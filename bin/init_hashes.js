const fs = require('fs');
const path = require('path');
const { hashElement } = require('folder-hash');

const packagesDir = path.join(__dirname, '../packages');
const outputFile = path.join(__dirname, '../.version_hashes.json');
const registry = {};

const options = {
    folders: { exclude: ['.*', 'node_modules', 'dist', 'lib'] },
    files: { include: ['*.js', '*.ts', '*.json', '*.md'] }
};

async function run() {
    const packages = fs.readdirSync(packagesDir);
    for (const pkg of packages) {
        const pkgDir = path.join(packagesDir, pkg);
        if(!fs.statSync(pkgDir).isDirectory()) continue;
        const pkgJsonPath = path.join(pkgDir, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            const { hash } = await hashElement(pkgDir, options);
            registry[pkgJson.name] = {
                version: pkgJson.version,
                hash: hash,
                last_published: new Date().toISOString()
            };
        }
    }
    fs.writeFileSync(outputFile, JSON.stringify(registry, null, 2), 'utf8');
    console.log(`Created ${outputFile}`);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
