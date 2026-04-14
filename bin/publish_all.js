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

// Explicit build order respecting dependency graph.
// 'yarn workspaces foreach -ptA' only orders by dependencies/devDependencies,
// NOT peerDependencies — so packages that declare internal deps as peerDeps
// (e.g. backend-firestore → @quatrain/backend) end up built out of order.
const BUILD_ORDER = [
    // Layer 0: no internal deps
    'log',
    // Layer 1: depends on log only
    'core',
    // Layer 2: depends on core
    'backend',
    'messaging',
    'queue',
    'storage',
    // Layer 3: depends on backend / queue / storage
    'auth',
    'cloudwrapper',         // depends on backend + storage
    'backend-firestore',    // depends on backend (peerDep)
    'backend-postgres',     // depends on backend
    'backend-sqlite',       // depends on backend
    'queue-amqp',           // depends on queue
    'queue-aws',            // depends on queue
    'queue-gcp',            // depends on queue
    'storage-firebase',     // depends on storage
    'storage-s3',           // depends on storage
    'storage-supabase',     // depends on storage
    // Layer 4: depends on cloudwrapper / auth
    'cloudwrapper-firebase',  // depends on cloudwrapper (peerDep) + backend (peerDep)
    'cloudwrapper-supabase',  // depends on cloudwrapper + backend
    'auth-firebase',          // depends on auth
    'auth-supabase',          // depends on auth
    'messaging-firebase',     // depends on messaging
    // Layer 5: depends on queue
    'worker',
];

async function publishAll() {
    let changed = false;

    // Clean stale tsconfig.tsbuildinfo files. These can contain paths from a
    // previous Yarn Berry PnP setup (.yarn/berry/cache/...) that are invalid
    // under nodeLinker: node-modules, causing TS2307 errors on incremental builds.
    console.log('[PREPARE] Cleaning stale tsconfig.tsbuildinfo files...');
    const { execSync: execSyncClean } = require('child_process');
    try {
        execSyncClean(`find ${packagesDir} -name "tsconfig.tsbuildinfo" -delete`, { stdio: 'inherit' });
    } catch (e) {
        // Non-fatal: proceed even if find/delete fails
    }

    console.log('[PREPARE] Building all workspaces in explicit dependency order...');
    for (const pkg of BUILD_ORDER) {
        const pkgDir = path.join(packagesDir, pkg);
        if (!fs.existsSync(pkgDir)) {
            console.log(`[BUILD] Skipping unknown package '${pkg}'`);
            continue;
        }
        console.log(`[BUILD] Building ${pkg}...`);
        execSync('yarn build', { cwd: pkgDir, stdio: 'inherit' });
    }
    // Build anything not listed in BUILD_ORDER last (no guaranteed order)
    const allPkgs = fs.readdirSync(packagesDir).filter(p =>
        fs.statSync(path.join(packagesDir, p)).isDirectory() &&
        !BUILD_ORDER.includes(p)
    );
    for (const pkg of allPkgs) {
        const pkgDir = path.join(packagesDir, pkg);
        if (!fs.existsSync(path.join(pkgDir, 'package.json'))) continue;
        console.log(`[BUILD] Building ${pkg} (unlisted)...`);
        execSync('yarn build', { cwd: pkgDir, stdio: 'inherit' });
    }

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
