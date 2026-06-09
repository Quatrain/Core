const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { computePackageHash, getDepsHash } = require('./hashUtils');

function runSync(command, args, options = {}) {
    const result = spawnSync(command, args, { ...options, shell: false });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`Command failed: ${command} ${args.join(' ')}\n${result.stderr ? result.stderr.toString() : ''}`);
    }
    return result.stdout ? result.stdout.toString() : '';
}
const workspacesDirs = [
    path.join(__dirname, '../packages')
];

function getPkgDir(pkg) {
    for (const dir of workspacesDirs) {
        const p = path.join(dir, pkg);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

const pkgNameMap = {};

function getAllPkgs() {
    const all = [];
    for (const dir of workspacesDirs) {
        if (!fs.existsSync(dir)) continue;
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const p = path.join(dir, item);
            if (fs.statSync(p).isDirectory()) {
                const pkgJsonPath = path.join(p, "package.json");
                if (fs.existsSync(pkgJsonPath)) {
                    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
                    pkgNameMap[pkgJson.name] = p;
                    all.push({ name: item, dir: p });
                }
            }
        }
    }
    return all;
}
const registryFile = path.join(__dirname, '../.version_hashes.json');
const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));

const options = {
    folders: { exclude: ['.*', 'node_modules', 'dist', 'lib'] },
    files: { include: ['*.js', '*.ts', '*.json', '*.md'] }
};

// BUILD_ORDER is removed in favor of Turborepo dependency graph resolution

async function publishAll() {
    let changed = false;
    const publishedPackages = [];

    // Clean stale tsconfig.tsbuildinfo files. These can contain paths from a
    // previous Yarn Berry PnP setup (.yarn/berry/cache/...) that are invalid
    // under nodeLinker: node-modules, causing TS2307 errors on incremental builds.
    console.log('[PREPARE] Cleaning stale tsconfig.tsbuildinfo files...');
    try {
        for (const dir of workspacesDirs) {
            runSync('find', [dir, '-name', 'tsconfig.tsbuildinfo', '-delete'], { stdio: 'inherit' });
        }
    } catch (e) {
        // Non-fatal: proceed even if find/delete fails
    }

    const packages = getAllPkgs().map(p => p.name);
    const computedHashes = {};
    const previousDataMap = {};
    let anyPackageChanged = false;
    
    console.log('[PREPARE] Computing stable hashes prior to build...');
    for (const pkg of packages) {
        const pkgDir = getPkgDir(pkg);
        if (!pkgDir || !fs.statSync(pkgDir).isDirectory()) continue;
        
        const pkgJsonPath = path.join(pkgDir, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) continue;
        
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const pkgName = pkgJson.name;
        
        computedHashes[pkgName] = await computePackageHash(pkgDir, pkgJson);
        previousDataMap[pkgName] = registry[pkgName] || {};
        
        const hasDist = fs.existsSync(path.join(pkgDir, 'dist')) || fs.existsSync(path.join(pkgDir, 'lib'));
        
        if (!hasDist || previousDataMap[pkgName].hash !== computedHashes[pkgName]) {
            anyPackageChanged = true;
        }
    }

    const forceBuild = process.argv.includes('--force');
    const tagArgIndex = process.argv.indexOf('--tag');
    const npmTag = tagArgIndex !== -1 ? process.argv[tagArgIndex + 1] : 'latest';
    const tagString = npmTag ? `--tag ${npmTag}` : '';

    if (!anyPackageChanged && !forceBuild) {
        console.log('[BUILD] No package changes detected and build artifacts present. Skipping build phase completely.');
    } else {
        console.log('[PREPARE] Building all workspaces using Turborepo...');
        const filters = [];
        for (const dir of workspacesDirs) {
            const relDir = path.relative(path.join(__dirname, '..'), dir);
            filters.push('--filter=./' + relDir + '/*');
        }
        runSync('npx', ['turbo', 'run', 'build', ...filters], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    }

    const isBuildOnly = process.argv.includes('--build-only');
    if (isBuildOnly) {
        console.log('[POST-BUILD] --build-only flag detected, skipping publishing.');
        return;
    }

    for (const pkg of packages) {
        const pkgDir = getPkgDir(pkg);
        if (!pkgDir || !fs.statSync(pkgDir).isDirectory()) continue;
        
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
                runSync('yarn', ['version', 'patch'], { cwd: pkgDir, stdio: 'inherit' });
                
                // Read new version and keep original content
                const originalPkgContent = fs.readFileSync(pkgJsonPath, 'utf8');
                const updatedPkgJson = JSON.parse(originalPkgContent);
                const newVersion = updatedPkgJson.version;
                
                // Strip workspace: protocol before packing
                ['dependencies', 'devDependencies', 'peerDependencies'].forEach(deptype => {
                    if (updatedPkgJson[deptype]) {
                        for (const [dep, ver] of Object.entries(updatedPkgJson[deptype])) {
                            if (ver.startsWith('workspace:')) {
                                 try {
                                     const targetDir = pkgNameMap[dep];
                                     if (!targetDir) throw new Error("Package not found in workspaces");
                                     const otherPkgJson = JSON.parse(fs.readFileSync(path.join(targetDir, "package.json"), 'utf8'));
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
                    
                    runSync('yarn', ['pack', '--out', 'package.tgz'], { cwd: pkgDir, stdio: 'inherit' });
                    
                    // Publish to npmjs.org
                    let existsNpmjs = false;
                    try {
                        const out = runSync('npm', ['view', `${pkgName}@${newVersion}`, 'version', '--registry', 'https://registry.npmjs.org/'], { cwd: pkgDir, stdio: 'pipe' }).trim();
                        if (out === newVersion) existsNpmjs = true;
                    } catch (e) { /* ignores 404 */ }

                    if (!existsNpmjs) {
                        try {
                            let publishArgsNpm = ['publish', 'package.tgz', '--registry', 'https://registry.npmjs.org/', '--access', 'public'];
                            if (process.env.GITHUB_ACTIONS) publishArgsNpm.push('--provenance');
                            if (npmTag) publishArgsNpm.push('--tag', npmTag);
                            runSync('npm', publishArgsNpm, { cwd: pkgDir, stdio: 'inherit' });
                        } catch (err) {
                            console.warn(`[WARNING] Failed to publish ${pkgName} to npmjs.org:`, err.message);
                        }
                    } else {
                        console.log(`[PUBLISH] ${pkgName}@${newVersion} already exists on npmjs, skipping.`);
                    }

                    // Publish to GitHub Packages
                    let existsGithub = false;
                    try {
                        const out = runSync('npm', ['view', `${pkgName}@${newVersion}`, 'version', '--registry', 'https://npm.pkg.github.com/'], { cwd: pkgDir, stdio: 'pipe' }).trim();
                        if (out === newVersion) existsGithub = true;
                    } catch (e) { /* ignores 404 */ }

                    if (!existsGithub) {
                        try {
                            let publishArgsGh = ['publish', 'package.tgz', '--registry', 'https://npm.pkg.github.com/'];
                            if (npmTag) publishArgsGh.push('--tag', npmTag);
                            runSync('npm', publishArgsGh, { cwd: pkgDir, stdio: 'inherit' });
                        } catch (err) {
                            console.warn(`[WARNING] Failed to publish ${pkgName} to GitHub Packages:`, err.message);
                        }
                    } else {
                        console.log(`[PUBLISH] ${pkgName}@${newVersion} already exists on GitHub Packages, skipping.`);
                    }
                } finally {
                    // Restore the package.json to retain workspace: protocols but keep the version bump
                    fs.writeFileSync(pkgJsonPath, originalPkgContent, 'utf8');
                    if (fs.existsSync(path.join(pkgDir, 'package.tgz'))) fs.unlinkSync(path.join(pkgDir, 'package.tgz'));
                    if (fs.existsSync(path.join(pkgDir, '.npmignore'))) fs.unlinkSync(path.join(pkgDir, '.npmignore'));
                }
                
                // Keep registry updated with the stable hash
                registry[pkgName] = {
                    version: newVersion,
                    hash: hash,
                    last_published: new Date().toISOString()
                };
                
                changed = true;
                console.log(`[PUBLISH] Success for ${pkgName} v${newVersion}`);
                publishedPackages.push({
                    Package: pkgName,
                    Version: newVersion
                });
                
            } catch (error) {
                console.error(`[ERROR] Failed to publish ${pkgName}:`, error.message);
                process.exit(1);
            }
        } else {
            console.log(`[SKIP] No changes in ${pkgName}. Version remains ${previousData.version}`);
            if (npmTag && npmTag !== 'latest') {
                try {
                    runSync('npm', ['dist-tag', 'add', `${pkgName}@${previousData.version}`, npmTag, '--registry', 'https://registry.npmjs.org/'], { stdio: 'ignore' });
                    runSync('npm', ['dist-tag', 'add', `${pkgName}@${previousData.version}`, npmTag, '--registry', 'https://npm.pkg.github.com/'], { stdio: 'ignore' });
                    console.log(`[PUBLISH] Tagged existing version ${pkgName}@${previousData.version} with ${npmTag}`);
                } catch (e) {
                    // Ignore if already tagged or unauthorized
                }
            }
        }
    }
    


    if (changed) {
        console.log('[POST-PUBLISH] Recomputing stable hashes to account for automatic workspace version bumps...');
        for (const pkgObj of getAllPkgs()) {
            const pkgDir = pkgObj.dir;
            const pkgJsonPath = path.join(pkgDir, 'package.json');
            if (!fs.existsSync(pkgJsonPath)) continue;
            
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            const pkgName = pkgJson.name;
            
            if (registry[pkgName] && registry[pkgName].hash) {
                const depsHash = getDepsHash(pkgJson);
                
                const oldRawHash = registry[pkgName].hash.split('-')[0];
                registry[pkgName].hash = `${oldRawHash}-${depsHash}`;
            }
        }
        
        fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf8');
        console.log(`Updated ${registryFile}`);
    } else {
        console.log('No package changes detected. Skipped publishing.');
    }

    if (publishedPackages.length > 0) {
        console.log('\n[SUMMARY] Published packages:');
        console.table(publishedPackages);
    }
}

publishAll();
