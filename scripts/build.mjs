import babel from '@babel/core';
import { promises as fs } from 'fs';
import path from 'path';
import prettier from 'prettier';
import ts from 'typescript';

// Paths
const srcDir = 'src';
const libDir = 'lib';
const tsLibDir = path.join(libDir, 'typescript');
const commonjsDir = path.join(libDir, 'commonjs');
const esmDir = path.join(libDir, 'module');
const prettierConfigPath = '.prettierrc.json';

// Clean lib directory
console.log('🧹 ', `Cleaning "${libDir}"...\n`);
await fs.rm(libDir, { recursive: true, force: true });

// Ensure directories exist
await fs.mkdir(tsLibDir, { recursive: true });
await fs.mkdir(commonjsDir, { recursive: true });
await fs.mkdir(esmDir, { recursive: true });

// Prettier configuration
const prettierOptions = await prettier.resolveConfig(prettierConfigPath);
prettierOptions.parser = 'babel';

// Read all files from src directory
const files = await fs.readdir(srcDir);

// TypeScript Compiler Options
console.log('📦 ', `Generating TypeScript declaration files...`);

const tsConfigPath = path.resolve('tsconfig.json');
const tsConfig = ts.readConfigFile(tsConfigPath, ts.sys.readFile).config;
tsConfig.compilerOptions.declarationDir = tsLibDir;
tsConfig.compilerOptions.emitDeclarationOnly = true;

const parsedCommandLine = ts.parseJsonConfigFileContent(tsConfig, ts.sys, path.dirname(tsConfigPath));

const tsFiles = files.filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));
const host = ts.createCompilerHost(parsedCommandLine.options);
const program = ts.createProgram(
  tsFiles.map(file => path.join(srcDir, file)),
  parsedCommandLine.options,
  host,
);
program.emit();

// Babel options
const babelOptions = (filename, commonjs = false) => ({
  presets: [['@babel/preset-env', { targets: 'defaults', modules: commonjs ? 'commonjs' : false }], '@babel/preset-typescript'],
  filename,
  sourceRoot: '../../src',
  sourceMaps: true,
});

for (const file of files) {
  console.log('\n' + file);

  const filePath = path.join(srcDir, file);
  const fileContent = await fs.readFile(filePath, 'utf8');

  // Transpile using Babel
  console.log('⚙️ ', `Transpiling: "${file}" to commonjs`);
  const commonjsResult = await babel.transformAsync(fileContent, babelOptions(file, true));

  console.log('⚙️ ', `Transpiling: "${file}" to ESM`);
  const esmResult = await babel.transformAsync(fileContent, babelOptions(file));

  const fileBaseName = path.basename(file, path.extname(file));
  const commonjsOutputPath = path.join(commonjsDir, `${fileBaseName}.js`);
  const commonjsMapOutputPath = path.join(commonjsDir, `${fileBaseName}.js.map`);
  const esmOutputPath = path.join(esmDir, `${fileBaseName}.js`);
  const esmMapOutputPath = path.join(esmDir, `${fileBaseName}.js.map`);

  // Format the code using Prettier
  prettierOptions.parser = 'babel';
  console.log('💄', `Formatting:  "${commonjsOutputPath}"`);
  const formattedCommonJSCode = await prettier.format(commonjsResult.code, prettierOptions);

  console.log('💄', `Formatting:  "${esmOutputPath}"`);
  const formattedESMCode = await prettier.format(esmResult.code, prettierOptions);

  // Format the source maps using Prettier
  prettierOptions.parser = 'json';
  console.log('💄', `Formatting:  "${commonjsMapOutputPath}"`);
  const formattedCommonJSMap = await prettier.format(JSON.stringify(commonjsResult.map ?? ''), prettierOptions);

  console.log('💄', `Formatting:  "${esmMapOutputPath}"`);
  const formattedESMMap = await prettier.format(JSON.stringify(esmResult.map ?? ''), prettierOptions);

  // Write the transpiled code and source maps to the respective directories
  console.log('✍️ ', `Writing:     "${commonjsOutputPath}"`);
  await fs.writeFile(commonjsOutputPath, formattedCommonJSCode, 'utf8');

  console.log('✍️ ', `Writing:     "${esmOutputPath}"`);
  await fs.writeFile(esmOutputPath, formattedESMCode, 'utf8');

  // write source maps if they exist
  if (commonjsResult.map) {
    console.log('✍️ ', `Writing:     "${commonjsMapOutputPath}"`);
    await fs.writeFile(commonjsMapOutputPath, formattedCommonJSMap, 'utf8');
  }

  if (esmResult.map) {
    console.log('✍️ ', `Writing:     "${esmMapOutputPath}"`);
    await fs.writeFile(esmMapOutputPath, formattedESMMap, 'utf8');
  }
}

console.log('\nCompilation successful!\n');
