#!/usr/bin/env ts-node

import { Project, SyntaxKind, SourceFile } from 'ts-morph';
import * as path from 'path';

/**
 * Second pass: Extract utility functions from inside the component
 * This extracts helper functions like validateForm, getRoleBadgeColor, etc.
 */

interface Pass2Options {
  targetFile: string;
  utilsFile: string;
  typesFile: string;
  helperNamePattern: RegExp;
}

interface CliArgs {
  file?: string;
  utils?: string;
  types?: string;
  helperPattern?: string;
  help?: boolean;
}

const DEFAULT_HELPER_PATTERN = '^(validate|get|format|handle)';

const toModuleSpecifier = (fromFile: string, toFile: string): string => {
  const relativePath = path
    .relative(path.dirname(fromFile), toFile)
    .replace(/\\/g, '/')
    .replace(/\.(tsx?|jsx?)$/, '');
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
};

const resolveOutputPath = (inputFile: string, suffix: string): string => {
  if (inputFile.endsWith('.tsx')) {
    return inputFile.replace(/\.tsx$/, suffix);
  }
  if (inputFile.endsWith('.ts')) {
    return inputFile.replace(/\.ts$/, suffix);
  }
  return `${inputFile}${suffix}`;
};

const parseArgs = (args: string[]): CliArgs => {
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;

    switch (arg) {
      case '--file':
        result.file = args[i + 1];
        i += 1;
        break;
      case '--utils':
        result.utils = args[i + 1];
        i += 1;
        break;
      case '--types':
        result.types = args[i + 1];
        i += 1;
        break;
      case '--helper-pattern':
        result.helperPattern = args[i + 1];
        i += 1;
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
      default:
        break;
    }
  }

  return result;
};

const printUsage = (): void => {
  console.log(`\nUsage:\n  ts-node scripts/refactor-tsx-pass2.ts --file <path> [options]\n\nOptions:\n  --utils <path>           Output utils file path (default: <file>.utils.ts)\n  --types <path>           Types file path for type-only imports\n  --helper-pattern <regex> Regex for helper function names (default: ${DEFAULT_HELPER_PATTERN})\n  --help                   Show this help message\n`);
};

class TSXRefactorer2 {
  private project: Project;
  private sourceFile: SourceFile;
  private options: Pass2Options;

  constructor(options: Pass2Options) {
    this.project = new Project({
      tsConfigFilePath: path.join(__dirname, '..', 'tsconfig.json'),
    });
    
    this.sourceFile = this.project.addSourceFileAtPath(options.targetFile);
    this.options = options;
  }

  /**
   * Extract helper functions that don't use hooks or state
   */
  extractHelperFunctions(): void {
    console.log('\n🔄 Extracting helper functions (2nd pass)...');
    
    const utilsFilePath = this.options.utilsFile;
    
    // Find the main component
    const componentDecl = this.sourceFile.getVariableDeclarations().find(decl => {
      const initializer = decl.getInitializer();
      return initializer?.isKind(SyntaxKind.ArrowFunction);
    });
    if (!componentDecl) {
      console.log('  ⚠️  Could not find component');
      return;
    }

    const arrowFunc = componentDecl.getInitializerIfKind(SyntaxKind.ArrowFunction);
    if (!arrowFunc) {
      console.log('  ⚠️  Component is not an arrow function');
      return;
    }

    const body = arrowFunc.getBody();
    if (!body || !body.isKind(SyntaxKind.Block)) {
      console.log('  ⚠️  Component body not found');
      return;
    }

    // Find helper functions inside the component
    const helperFunctions: Array<{ name: string; text: string }> = [];
    
    // Look for const declarations with arrow functions
    const block = body.asKind(SyntaxKind.Block);
    if (!block) return;

    const statements = block.getStatements();
    
    statements.forEach(stmt => {
      if (stmt.isKind(SyntaxKind.VariableStatement)) {
        const declarations = stmt.getDeclarations();
        
        declarations.forEach(decl => {
          const name = decl.getName();
          const initializer = decl.getInitializer();
          
          // Check if it's a helper function (arrow function that doesn't use hooks)
          if (initializer && initializer.isKind(SyntaxKind.ArrowFunction)) {
            const text = stmt.getText();
            
            // Extract these specific helper functions
            if (this.options.helperNamePattern.test(name)) {
              helperFunctions.push({ name, text });
            }
          }
        });
      }
    });

    if (helperFunctions.length === 0) {
      console.log('  ⏭️  No helper functions to extract');
      return;
    }

    // Read existing utils file or create new content
    let utilsContent = '';
    try {
      const existingUtils = this.project.getSourceFile(utilsFilePath);
      if (existingUtils) {
        utilsContent = existingUtils.getFullText();
      }
    } catch (e) {
      // File doesn't exist yet
      utilsContent = [
        '/**',
        ' * Extracted utility functions',
        ' * Auto-generated by ts-morph refactoring script',
        ' */',
        '',
        this.getTypeImportStatement(utilsFilePath),
        '',
      ].filter(Boolean).join('\n');
    }

    // Add the helper functions
    const exportedFunctions = helperFunctions.map(func => {
      // Make it exported
      const exportedText = func.text.replace(/^(\s*)(const|let|var)/, '$1export const');
      console.log(`  ✓ Extracted: ${func.name}`);
      return exportedText;
    });

    utilsContent += '\n' + exportedFunctions.join('\n\n');

    // Write the utils file
    const utilsFile = this.project.createSourceFile(utilsFilePath, utilsContent, { overwrite: true });
    utilsFile.saveSync();

    // Remove helper functions from component and add imports
    const functionNames = helperFunctions.map(f => f.name);
    
    statements.forEach(stmt => {
      if (stmt.isKind(SyntaxKind.VariableStatement)) {
        const declarations = stmt.getDeclarations();
        declarations.forEach(decl => {
          const name = decl.getName();
          if (functionNames.includes(name)) {
            stmt.remove();
          }
        });
      }
    });

    // Add import
    const moduleSpecifier = toModuleSpecifier(this.options.targetFile, utilsFilePath);
    const existingImport = this.sourceFile.getImportDeclaration(moduleSpecifier);
    if (existingImport) {
      const namedImports = existingImport.getNamedImports().map(ni => ni.getName());
      const newImports = [...new Set([...namedImports, ...functionNames])];
      existingImport.remove();
      this.sourceFile.addImportDeclaration({
        moduleSpecifier,
        namedImports: newImports,
      });
    } else {
      this.sourceFile.addImportDeclaration({
        moduleSpecifier,
        namedImports: functionNames,
      });
    }

    this.sourceFile.saveSync();
    console.log(`  💾 Saved: ${path.basename(utilsFilePath)}`);
  }

  save(): void {
    this.sourceFile.saveSync();
    console.log('\n✅ Second pass refactoring complete!');
  }

  private getExportedTypeNames(): string[] {
    if (!this.options.typesFile) {
      return [];
    }

    const typesFile = this.project.getSourceFile(this.options.typesFile);
    if (!typesFile) {
      return [];
    }

    const interfaces = typesFile.getInterfaces();
    const typeAliases = typesFile.getTypeAliases();

    return [...interfaces, ...typeAliases]
      .filter(type => type.isExported())
      .map(type => type.getName());
  }

  private getTypeImportStatement(utilsFilePath: string): string | null {
    if (!this.options.typesFile) {
      return null;
    }

    const typeNames = this.getExportedTypeNames();
    if (typeNames.length === 0) {
      return null;
    }

    return `import type { ${typeNames.join(', ')} } from '${toModuleSpecifier(utilsFilePath, this.options.typesFile)}';`;
  }
}

async function main() {
  console.log('🚀 TSX Refactoring Tool - Second Pass\n');

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const targetFile = args.file
    ? path.resolve(args.file)
    : path.join(__dirname, '..', 'src', 'components', 'UserManagementDashboard.tsx');

  const typesFile = args.types ? path.resolve(args.types) : resolveOutputPath(targetFile, '.types.ts');

  const refactorer = new TSXRefactorer2({
    targetFile,
    utilsFile: path.resolve(args.utils ?? resolveOutputPath(targetFile, '.utils.ts')),
    typesFile,
    helperNamePattern: new RegExp(args.helperPattern ?? DEFAULT_HELPER_PATTERN),
  });
  refactorer.extractHelperFunctions();
  refactorer.save();

  console.log('\n💡 Helper functions extracted!');
  console.log('  - Run npm run type-check to verify');
}

main().catch(console.error);
