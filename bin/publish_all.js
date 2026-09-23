const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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
    
    const forceBuild = process.argv.includes('--force');
    const tagArgIndex = process.argv.indexOf('--tag');
    const isBeta = process.argv.includes('--beta') || (tagArgIndex !== -1 && process.argv[tagArgIndex + 1] === 'beta');
    const defaultTag = isBeta ? 'beta' : 'latest';
    const npmTag = tagArgIndex !== -1 ? process.argv[tagArgIndex + 1] : defaultTag;
    const tagString = npmTag ? `--tag ${npmTag}` : '';

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
        const needsFinalize = !isBeta && pkgJson.version.includes('-beta');
        
        if (!hasDist || previousDataMap[pkgName].hash !== computedHashes[pkgName] || needsFinalize) {
            anyPackageChanged = true;
        }
    }

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
        const previousData = previousDataMap[pkgName] || {};
        const prevBuf = Buffer.from(previousData.hash || '');
        const currBuf = Buffer.from(hash || '');
        const isHashMatching = prevBuf.length === currBuf.length && crypto.timingSafeEqual(prevBuf, currBuf);

        const needsFinalize = !isBeta && pkgJson.version.includes('-beta');

        if (!isHashMatching || needsFinalize) {
            console.log(`[PUBLISH] Changes detected or beta finalization needed in ${pkgName}. Releasing...`);
            
            try {
                let newVersion;
                let updatedPkgJson;
                const originalPkgContent = fs.readFileSync(pkgJsonPath, 'utf8');
                let bumpedContent = originalPkgContent;

                if (isBeta) {
                    const currentVer = pkgJson.version;
                    const betaMatch = currentVer.match(/^(\d+\.\d+\.\d+)-beta\.(\d+)$/);
                    if (betaMatch) {
                        const nextCount = parseInt(betaMatch[2], 10) + 1;
                        newVersion = `${betaMatch[1]}-beta.${nextCount}`;
                    } else {
                        // Current version is stable (e.g. 1.2.19), bump patch and append -beta.0
                        const base = currentVer.split('-')[0];
                        const parts = base.split('.').map(Number);
                        parts[2] = (parts[2] || 0) + 1;
                        newVersion = `${parts.join('.')}-beta.0`;
                    }
                    runSync('yarn', ['version', newVersion], { cwd: pkgDir, stdio: 'inherit' });
                    bumpedContent = fs.readFileSync(pkgJsonPath, 'utf8');
                    updatedPkgJson = JSON.parse(bumpedContent);
                } else {
                    // Standard stable release (on main)
                    if (pkgJson.version.includes('-beta')) {
                        // Finalize beta version to stable SemVer
                        newVersion = pkgJson.version.split('-')[0];
                        runSync('yarn', ['version', newVersion], { cwd: pkgDir, stdio: 'inherit' });
                        bumpedContent = fs.readFileSync(pkgJsonPath, 'utf8');
                        updatedPkgJson = JSON.parse(bumpedContent);
                    } else {
                        runSync('yarn', ['version', 'patch'], { cwd: pkgDir, stdio: 'inherit' });
                        bumpedContent = fs.readFileSync(pkgJsonPath, 'utf8');
                        updatedPkgJson = JSON.parse(bumpedContent);
                        newVersion = updatedPkgJson.version;
                    }
                }
                
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

                // Ensure repository metadata exists for npm provenance verification
                if (!updatedPkgJson.repository || !updatedPkgJson.repository.url) {
                    updatedPkgJson.repository = {
                        type: 'git',
                        url: 'git+https://github.com/Quatrain/Core.git',
                        directory: `packages/${pkg}`
                    };
                }

                try {
                    // Temporarily write the versioned + stripped file
                    fs.writeFileSync(pkgJsonPath, JSON.stringify(updatedPkgJson, null, 2), 'utf8');
                    // Provide explicit .npmignore so yarn pack doesn't use .gitignore (which ignores lib and dist)
                    fs.writeFileSync(path.join(pkgDir, '.npmignore'), 'node_modules\ncoverage\n.git\n*.test.ts\n*.test.tsx\n*.spec.ts\ntests/\n__tests__/\n', 'utf8');
                    
                    runSync('yarn', ['pack', '--out', 'package.tgz'], { cwd: pkgDir, stdio: 'inherit' });
                    
                    // Publish to npmjs.org
                    let existsNpmjs = false;
                    try {
                        const out = runSync('npm', ['view', `${pkgName}@${newVersion}`, 'version', '--registry', 'https://registry.npmjs.org/'], { cwd: pkgDir, stdio: 'pipe' }).trim();
                        if (out === newVersion) existsNpmjs = true;
                    } catch (e) { /* ignores 404 */ }

                    if (!existsNpmjs) {
                        let publishArgsNpm = ['publish', 'package.tgz', '--registry', 'https://registry.npmjs.org/', '--access', 'public'];
                        if (process.env.GITHUB_ACTIONS) publishArgsNpm.push('--provenance');
                        if (npmTag) publishArgsNpm.push('--tag', npmTag);
                        runSync('npm', publishArgsNpm, { cwd: pkgDir, stdio: 'inherit' });
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
                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    fs.writeFileSync(pkgJsonPath, bumpedContent, 'utf8');
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
                
                console.log(`[PUBLISH] Success for ${pkgName} v${newVersion} (tag: ${npmTag})`);
                publishedPackages.push({
                    Package: pkgName,
                    Version: newVersion,
                    Tag: npmTag
                });
                
            } catch (error) {
                console.error(`[ERROR] Failed to publish ${pkgName}:`, error.message);
                process.exit(1);
            }
        } else {
            // Check if existing version is missing on npmjs (e.g. from an earlier expired token or aborted run)
            let existsNpmjs = false;
            try {
                const out = runSync('npm', ['view', `${pkgName}@${previousData.version}`, 'version', '--registry', 'https://registry.npmjs.org/'], { cwd: pkgDir, stdio: 'pipe' }).trim();
                if (out === previousData.version) existsNpmjs = true;
            } catch (e) { /* ignores 404 */ }

            if (!existsNpmjs) {
                console.log(`[REPAIR] Missing release detected on npmjs for ${pkgName}@${previousData.version}. Publishing...`);
                try {
                    const originalPkgContent = fs.readFileSync(pkgJsonPath, 'utf8');
                    const updatedPkgJson = JSON.parse(originalPkgContent);

                    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(deptype => {
                        if (updatedPkgJson[deptype]) {
                            for (const [dep, ver] of Object.entries(updatedPkgJson[deptype])) {
                                if (ver.startsWith('workspace:')) {
                                    try {
                                        const targetDir = pkgNameMap[dep];
                                        if (targetDir) {
                                            const otherPkgJson = JSON.parse(fs.readFileSync(path.join(targetDir, "package.json"), 'utf8'));
                                            updatedPkgJson[deptype][dep] = `^${otherPkgJson.version}`;
                                        }
                                    } catch(e) {}
                                }
                            }
                        }
                    });

                    try {
                        fs.writeFileSync(pkgJsonPath, JSON.stringify(updatedPkgJson, null, 2), 'utf8');
                        fs.writeFileSync(path.join(pkgDir, '.npmignore'), 'node_modules\ncoverage\n.git\n*.test.ts\n*.test.tsx\n*.spec.ts\ntests/\n__tests__/\n', 'utf8');
                        runSync('yarn', ['pack', '--out', 'package.tgz'], { cwd: pkgDir, stdio: 'inherit' });

                        let publishArgsNpm = ['publish', 'package.tgz', '--registry', 'https://registry.npmjs.org/', '--access', 'public'];
                        if (process.env.GITHUB_ACTIONS) publishArgsNpm.push('--provenance');
                        if (npmTag) publishArgsNpm.push('--tag', npmTag);
                        runSync('npm', publishArgsNpm, { cwd: pkgDir, stdio: 'inherit' });
                        console.log(`[REPAIR] Successfully published ${pkgName}@${previousData.version} to npmjs.org`);
                    } finally {
                        fs.writeFileSync(pkgJsonPath, originalPkgContent, 'utf8');
                        if (fs.existsSync(path.join(pkgDir, 'package.tgz'))) fs.unlinkSync(path.join(pkgDir, 'package.tgz'));
                        if (fs.existsSync(path.join(pkgDir, '.npmignore'))) fs.unlinkSync(path.join(pkgDir, '.npmignore'));
                    }
                } catch (repairErr) {
                    console.error(`[ERROR] Failed to repair release for ${pkgName}@${previousData.version}:`, repairErr.message);
                    process.exit(1);
                }
            } else {
                console.log(`[SKIP] No changes in ${pkgName}. Version remains ${previousData.version}`);
            }

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
