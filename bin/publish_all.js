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

    const packages = fs.readdirSync(packagesDir);
    const computedHashes = {};
    const previousDataMap = {};
    let anyPackageChanged = false;
    
    console.log('[PREPARE] Computing stable hashes prior to build...');
    for (const pkg of packages) {
        const pkgDir = path.join(packagesDir, pkg);
        if (!fs.statSync(pkgDir).isDirectory()) continue;
        
        const pkgJsonPath = path.join(pkgDir, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) continue;
        
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const pkgName = pkgJson.name;
        
        // Exclude package.json from raw file hash to avoid formatting/version bump mismatches
        const hashOptions = {
            folders: { exclude: ['.*', 'node_modules', 'dist', 'lib'] },
            files: { include: ['*.js', '*.ts', '*.json', '*.md'], exclude: ['package.json', 'tsconfig.tsbuildinfo'] }
        };
        const { hash: rawHash } = await hashElement(pkgDir, hashOptions);
        
        // Include relevant package.json fields deterministically
        const depsHash = require('crypto').createHash('sha256').update(JSON.stringify({
            dependencies: pkgJson.dependencies || {},
            peerDependencies: pkgJson.peerDependencies || {},
            scripts: pkgJson.scripts || {},
            bin: pkgJson.bin || {}
        })).digest('hex');
        computedHashes[pkgName] = `${rawHash}-${depsHash}`;
        previousDataMap[pkgName] = registry[pkgName] || {};
        
        const hasDist = fs.existsSync(path.join(pkgDir, 'dist')) || fs.existsSync(path.join(pkgDir, 'lib'));
        
        if (!hasDist || previousDataMap[pkgName].hash !== computedHashes[pkgName]) {
            anyPackageChanged = true;
        }
    }

    const forceBuild = process.argv.includes('--force');

    if (!anyPackageChanged && !forceBuild) {
        console.log('[BUILD] No package changes detected and build artifacts present. Skipping build phase completely.');
    } else {
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
    }

    for (const pkg of packages) {
        const pkgDir = path.join(packagesDir, pkg);
        if (!fs.statSync(pkgDir).isDirectory()) continue;
        
        const pkgJsonPath = path.join(pkgDir, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) continue;
        
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const pkgName = pkgJson.name;
        
        const hash = computedHashes[pkgName];
        const previousData = previousDataMap[pkgName];
        
        if (previousData.hash !== hash) {
            console.log(`[PUBLISH] Changes detected in ${pkgName}. Releasing...`);
            
            try {
                // Execute standard release pipeline
                execSync('yarn version patch', { cwd: pkgDir, stdio: 'inherit' });
                
                // Read new version and keep original content
                const originalPkgContent = fs.readFileSync(pkgJsonPath, 'utf8');
                const updatedPkgJson = JSON.parse(originalPkgContent);
                const newVersion = updatedPkgJson.version;
                
                // Strip workspace: protocol before packing
                ['dependencies', 'devDependencies', 'peerDependencies'].forEach(deptype => {
                    if (updatedPkgJson[deptype]) {
                        for (const [dep, ver] of Object.entries(updatedPkgJson[deptype])) {
                            if (ver.startsWith('workspace:')) {
                                const cleanName = dep.replace('@quatrain/', '');
                                try {
                                    const otherPkgJson = JSON.parse(fs.readFileSync(path.join(packagesDir, cleanName, 'package.json'), 'utf8'));
                                    updatedPkgJson[deptype][dep] = `^${otherPkgJson.version}`;
                                } catch(e) {
                                    console.warn(`[WARNING] Could not resolve workspace version for ${dep}`);
                                }
                            }
                        }
                    }
                });

                try {
                    // Temporarily write the versioned + stripped file
                    fs.writeFileSync(pkgJsonPath, JSON.stringify(updatedPkgJson, null, 2), 'utf8');
                    // Provide explicit .npmignore so yarn pack doesn't use .gitignore (which ignores lib and dist)
                    fs.writeFileSync(path.join(pkgDir, '.npmignore'), 'node_modules\ncoverage\n.git\n', 'utf8');
                    
                    execSync('yarn pack --out package.tgz', { cwd: pkgDir, stdio: 'inherit' });
                    
                    // Publish to npmjs.org
                    let existsNpmjs = false;
                    try {
                        const out = execSync(`npm view ${pkgName}@${newVersion} version --registry https://registry.npmjs.org/`, { cwd: pkgDir, stdio: 'pipe' }).toString().trim();
                        if (out === newVersion) existsNpmjs = true;
                    } catch (e) { /* ignores 404 */ }

                    if (!existsNpmjs) {
                        execSync('npm publish package.tgz --registry https://registry.npmjs.org/ --access public --provenance', { cwd: pkgDir, stdio: 'inherit' });
                    } else {
                        console.log(`[PUBLISH] ${pkgName}@${newVersion} already exists on npmjs, skipping.`);
                    }

                    // Publish to GitHub Packages
                    let existsGithub = false;
                    try {
                        const out = execSync(`npm view ${pkgName}@${newVersion} version --registry https://npm.pkg.github.com/`, { cwd: pkgDir, stdio: 'pipe' }).toString().trim();
                        if (out === newVersion) existsGithub = true;
                    } catch (e) { /* ignores 404 */ }

                    if (!existsGithub) {
                        execSync('npm publish package.tgz --registry https://npm.pkg.github.com/', { cwd: pkgDir, stdio: 'inherit' });
                    } else {
                        console.log(`[PUBLISH] ${pkgName}@${newVersion} already exists on GitHub Packages, skipping.`);
                    }
                } finally {
                    // Restore the package.json to retain workspace: protocols but keep the version bump
                    fs.writeFileSync(pkgJsonPath, originalPkgContent, 'utf8');
                    execSync('rm -f package.tgz', { cwd: pkgDir, stdio: 'inherit' });
                    execSync('rm -f .npmignore', { cwd: pkgDir, stdio: 'inherit' });
                }
                
                // Keep registry updated with the stable hash
                registry[pkgName] = {
                    version: newVersion,
                    hash: hash,
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
    
    const isBuildOnly = process.argv.includes('--build-only');
    if (isBuildOnly) {
        console.log('[POST-BUILD] --build-only flag detected, skipping publishing.');
        return;
    }

    if (changed) {
        console.log('[POST-PUBLISH] Recomputing stable hashes to account for automatic workspace version bumps...');
        for (const pkg of packages) {
            const pkgDir = path.join(packagesDir, pkg);
            if (!fs.statSync(pkgDir).isDirectory()) continue;
            const pkgJsonPath = path.join(pkgDir, 'package.json');
            if (!fs.existsSync(pkgJsonPath)) continue;
            
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            const pkgName = pkgJson.name;
            
            if (registry[pkgName] && registry[pkgName].hash) {
                const depsHash = require('crypto').createHash('sha256').update(JSON.stringify({
                    dependencies: pkgJson.dependencies || {},
                    peerDependencies: pkgJson.peerDependencies || {},
                    scripts: pkgJson.scripts || {},
                    bin: pkgJson.bin || {}
                })).digest('hex');
                
                const oldRawHash = registry[pkgName].hash.split('-')[0];
                registry[pkgName].hash = `${oldRawHash}-${depsHash}`;
            }
        }
        
        fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf8');
        console.log(`Updated ${registryFile}`);
    } else {
        console.log('No package changes detected. Skipped publishing.');
    }
}

publishAll();
