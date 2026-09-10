import { execFileSync } from 'node:child_process';
import { ESLint } from 'eslint';
import js from '@eslint/js';
import globals from 'globals';
const files = [...new Set([
  ...execFileSync('/usr/bin/git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split('\n'),
  ...execFileSync('/usr/bin/git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n'),
])];
const source = files.filter((file) => /^(src|api|test)\/.+\.(js|jsx)$/.test(file));
const tooling = files.filter((file) => /^scripts\/recruiting-two-box-review\/.+\.mjs$/.test(file));
const eslint = new ESLint();
const toolLint = new ESLint({ overrideConfigFile: true, overrideConfig: [js.configs.recommended, { languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.browser } } }] });
const results = [...await eslint.lintFiles(source), ...await toolLint.lintFiles(tooling)];
console.log(await (await eslint.loadFormatter('stylish')).format(results));
const errors = results.reduce((total, result) => total + result.errorCount, 0);
const warnings = results.reduce((total, result) => total + result.warningCount, 0);
console.log(JSON.stringify({ source_files: source, tooling_files: tooling, errors, warnings, scope: 'All changed/new Product source, tests and campaign tooling; not repository-wide lint' }));
process.exitCode = errors || warnings ? 1 : 0;
