/**
 * Refuses client names and business-domain words in the packages and their documentation.
 *
 * Core is generic: no package may carry the name, data or vocabulary of an application that
 * uses it. The words are listed in `bin/forbidden-terms.sha256` as SHA-256 hashes of their
 * normalized form (lower case, no accent), so the list does not disclose them. Every word of
 * every tracked text file under the scanned paths is normalized, hashed and looked up.
 *
 * Usage:
 *   node bin/check_forbidden_terms.js            scan; exit 1 when a word is found
 *   node bin/check_forbidden_terms.js --hash w   print the line to add to the list for `w`
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.join(__dirname, '..');
const LIST = path.join(__dirname, 'forbidden-terms.sha256');
const SCANNED = ['packages', 'docs/pages', 'docs/*.md', 'README.md', 'guidelines'];
const SKIPPED = [/\.js$/, /\.map$/, /\.lock$/, /LICENSE\.md$/, /\.(png|jpe?g|gif|svg|ico|pdf|woff2?)$/i];
const WORD = /[\p{L}\p{N}]+/gu;

/** Lower case, accents removed. */
function normalize(word) {
   return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function hash(word) {
   return crypto.createHash('sha256').update(normalize(word)).digest('hex');
}

function readList() {
   return new Set(
      fs
         .readFileSync(LIST, 'utf8')
         .split('\n')
         .map((line) => line.trim().split(/\s+/)[0])
         .filter((entry) => /^[0-9a-f]{64}$/.test(entry))
   );
}

function trackedFiles() {
   const result = spawnSync('git', ['ls-files', '-z', '--', ...SCANNED], { cwd: repositoryRoot, encoding: 'utf8' });
   if (result.status !== 0) {
      throw new Error(`git ls-files failed: ${result.stderr}`);
   }
   return result.stdout.split('\0').filter((file) => file !== '' && !SKIPPED.some((pattern) => pattern.test(file)));
}

function scan() {
   const forbidden = readList();
   const findings = [];
   for (const file of trackedFiles()) {
      const text = fs.readFileSync(path.join(repositoryRoot, file), 'utf8');
      text.split('\n').forEach((line, index) => {
         for (const match of line.matchAll(WORD)) {
            if (forbidden.has(hash(match[0]))) {
               findings.push(`${file}:${index + 1}: "${match[0]}"`);
            }
         }
      });
   }
   return findings;
}

if (process.argv[2] === '--hash') {
   for (const word of process.argv.slice(3)) {
      console.log(hash(word));
   }
   process.exit(0);
}

const findings = scan();
if (findings.length > 0) {
   console.error('Client or business-domain words found in the packages (see bin/check_forbidden_terms.js):');
   for (const finding of findings) {
      console.error(`  ${finding}`);
   }
   process.exit(1);
}
console.log('No forbidden word found.');
