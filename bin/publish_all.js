const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { hashElement } = require('folder-hash');

const packagesDir = path.join(__dirname, '../packages');
const registryFile = path.join(__dirname, '../.version_hashes.json');
const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));

const options = {
    folders: { exclude: ['.*', 'node_modules', 'dist', 'lib'] },
    files: { include: ['*.js', '*.ts', '*.json', '*.md'] }
};

async function publishAll() {
    let changed = false;
    
    console.log('[PREPARE] Building all workspaces topologically...');
    execSync('yarn build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

    const packages = fs.readdirSync(packagesDir);
    
    for (const pkg of packages) {
        const pkgDir = path.join(packagesDir, pkg);
        if (!fs.statSync(pkgDir).isDirectory()) continue;
        
        const pkgJsonPath = path.join(pkgDir, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) continue;
        
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const pkgName = pkgJson.name;
        const { hash } = await hashElement(pkgDir, options);
        
        const previousData = registry[pkgName] || {};
        
        if (previousData.hash !== hash) {
            console.log(`[PUBLISH] Changes detected in ${pkgName}. Releasing...`);
            
            try {
                // Execute standard release pipeline
                execSync('yarn version patch', { cwd: pkgDir, stdio: 'inherit' });
                
                // Read new version
                const updatedPkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                const newVersion = updatedPkgJson.version;
                
                execSync('cp ../../LICENSE.md .', { cwd: pkgDir, stdio: 'inherit' });
                execSync('yarn pack --out package.tgz', { cwd: pkgDir, stdio: 'inherit' });
                
                // Publish
                execSync('npm publish package.tgz --registry https://registry.npmjs.org/ --access public', { cwd: pkgDir, stdio: 'inherit' });
                execSync('npm publish package.tgz --registry https://npm.pkg.github.com/', { cwd: pkgDir, stdio: 'inherit' });
                
                // Cleanup
                execSync('rm package.tgz', { cwd: pkgDir, stdio: 'inherit' });
                
                // Recompute hash after all these writes just in case package.json changes affect it.
                // Actually the hash is on src/ and excludes dist/, so the source hash won't change
                // but the package.json HAS changed due to yarn version patch. So we must recompute
                // the hash including the new package.json version so that next run it matches!
                const newHashResult = await hashElement(pkgDir, options);
                
                // Keep registry updated
                registry[pkgName] = {
                    version: newVersion,
                    hash: newHashResult.hash,
                    last_published: new Date().toISOString()
                };
                
                changed = true;
                console.log(`[PUBLISH] Success for ${pkgName} v${newVersion}`);
                
            } catch (error) {
                console.error(`[ERROR] Failed to publish ${pkgName}:`, error.message);
                process.exit(1);
            }
        } else {
            console.log(`[SKIP] No changes in ${pkgName}. Version remains ${previousData.version}`);
        }
    }
    
    if (changed) {
        fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf8');
        console.log(`Updated ${registryFile}`);
    } else {
        console.log('No package changes detected. Skipped publishing.');
    }
}

publishAll();
