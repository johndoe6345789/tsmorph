#!/usr/bin/env ts-node

import { Project, SyntaxKind, SourceFile, Node } from 'ts-morph';
import * as path from 'path';

/**
 * TSX Refactoring Script using ts-morph
 * 
 * This script demonstrates how to use ts-morph to:
 * 1. Analyze TSX files for large code blocks (>150 LOC)
 * 2. Extract components and utilities to separate files
 * 3. Automatically fix imports
 */

interface ExtractionCandidate {
  name: string;
  node: Node;
  lineCount: number;
  type: 'function' | 'component' | 'interface' | 'type' | 'variable';
}

interface RefactorOptions {
  targetFile: string;
  typesFile: string;
  utilsFile: string;
  minFunctionLines: number;
  minVariableLines: number;
  utilNamePattern: RegExp;
}

interface CliArgs {
  file?: string;
  types?: string;
  utils?: string;
  minFunctionLines?: number;
  minVariableLines?: number;
  utilPattern?: string;
  help?: boolean;
}

const DEFAULT_MIN_FUNCTION_LINES = 20;
const DEFAULT_MIN_VARIABLE_LINES = 10;
const DEFAULT_UTIL_PATTERN = '^(validate|format|get|handle)';

const toModuleSpecifier = (fromFile: string, toFile: string): string => {
  const relativePath = path
    .relative(path.dirname(fromFile), toFile)
    .replace(/\\/g, '/')
    .replace(/\.(tsx?|jsx?)$/, '');
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
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
      case '--types':
        result.types = args[i + 1];
        i += 1;
        break;
      case '--utils':
        result.utils = args[i + 1];
        i += 1;
        break;
      case '--min-function-lines':
        result.minFunctionLines = Number(args[i + 1]);
        i += 1;
        break;
      case '--min-variable-lines':
        result.minVariableLines = Number(args[i + 1]);
        i += 1;
        break;
      case '--util-pattern':
        result.utilPattern = args[i + 1];
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
  console.log(`\nUsage:\n  ts-node scripts/refactor-tsx.ts --file <path> [options]\n\nOptions:\n  --types <path>               Output types file path (default: <file>.types.ts)\n  --utils <path>               Output utils file path (default: <file>.utils.ts)\n  --min-function-lines <num>   Minimum lines before extracting functions (default: ${DEFAULT_MIN_FUNCTION_LINES})\n  --min-variable-lines <num>   Minimum lines before extracting variables (default: ${DEFAULT_MIN_VARIABLE_LINES})\n  --util-pattern <regex>       Regex for utility names (default: ${DEFAULT_UTIL_PATTERN})\n  --help                       Show this help message\n`);
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

class TSXRefactorer {
  private project: Project;
  private sourceFile: SourceFile;
  private options: RefactorOptions;

  constructor(options: RefactorOptions) {
    this.project = new Project({
      tsConfigFilePath: path.join(__dirname, '..', 'tsconfig.json'),
    });
    
    this.sourceFile = this.project.addSourceFileAtPath(options.targetFile);
    this.options = options;
  }

  /**
   * Analyze the file and identify extraction candidates
   */
  analyzeFile(): ExtractionCandidate[] {
    const candidates: ExtractionCandidate[] = [];

    console.log('\n📊 Analyzing file:', this.sourceFile.getFilePath());
    console.log('Total lines:', this.sourceFile.getEndLineNumber());

    // Find all function declarations
    const functions = this.sourceFile.getFunctions();
    functions.forEach(func => {
      const lineCount = this.getNodeLineCount(func);
      if (lineCount > this.options.minFunctionLines) {
        candidates.push({
          name: func.getName() || 'anonymous',
          node: func,
          lineCount,
          type: 'function',
        });
      }
    });

    // Find all variable statements (includes arrow functions and hooks)
    const variableStatements = this.sourceFile.getVariableStatements();
    variableStatements.forEach(stmt => {
      const declarations = stmt.getDeclarations();
      declarations.forEach(decl => {
        const lineCount = this.getNodeLineCount(decl);
        const name = decl.getName();
        
        if (lineCount > this.options.minVariableLines) {
          candidates.push({
            name,
            node: decl,
            lineCount,
            type: 'variable',
          });
        }
      });
    });

    // Find all interface declarations
    const interfaces = this.sourceFile.getInterfaces();
    interfaces.forEach(iface => {
      candidates.push({
        name: iface.getName(),
        node: iface,
        lineCount: this.getNodeLineCount(iface),
        type: 'interface',
      });
    });

    // Find all type aliases
    const typeAliases = this.sourceFile.getTypeAliases();
    typeAliases.forEach(typeAlias => {
      candidates.push({
        name: typeAlias.getName(),
        node: typeAlias,
        lineCount: this.getNodeLineCount(typeAlias),
        type: 'type',
      });
    });

    return candidates;
  }

  /**
   * Extract types and interfaces to a separate file
   */
  extractTypes(candidates: ExtractionCandidate[]): void {
    const typeCandidates = candidates.filter(c => 
      c.type === 'interface' || c.type === 'type'
    );

    if (typeCandidates.length === 0) {
      console.log('\n⏭️  No types to extract');
      return;
    }

    console.log('\n🔄 Extracting types to separate file...');
    
    const typesFilePath = this.options.typesFile;
    const typesFile = this.project.createSourceFile(typesFilePath, '', { overwrite: true });

    // Build the content for the types file
    const typesContent = [
      '/**',
      ' * Extracted types and interfaces',
      ' * Auto-generated by ts-morph refactoring script',
      ' */',
      '',
      ...typeCandidates.map(candidate => {
        const text = candidate.node.getText();
        // Add export if not already present
        return text.startsWith('export ') ? text : `export ${text}`;
      }),
    ].join('\n');

    // Write the content
    typesFile.replaceWithText(typesContent);

    typeCandidates.forEach(candidate => {
      console.log(`  ✓ Extracted: ${candidate.name} (${candidate.lineCount} lines)`);
    });

    // Remove from original file
    typeCandidates.forEach(candidate => {
      if (Node.isInterfaceDeclaration(candidate.node) || Node.isTypeAliasDeclaration(candidate.node)) {
        candidate.node.remove();
      }
    });

    // Add import to original file
    const typeNames = typeCandidates.map(c => c.name);
    if (typeNames.length > 0) {
      const moduleSpecifier = toModuleSpecifier(this.options.targetFile, typesFilePath);
      this.addOrUpdateNamedImport(moduleSpecifier, typeNames);
    }

    typesFile.saveSync();
    console.log(`  💾 Saved: ${path.basename(typesFilePath)}`);
  }

  /**
   * Extract utility functions to a separate file
   */
  extractUtilities(candidates: ExtractionCandidate[]): void {
    const utilCandidates = candidates.filter(c => 
      c.type === 'variable' && this.options.utilNamePattern.test(c.name)
    );

    if (utilCandidates.length === 0) {
      console.log('\n⏭️  No utilities to extract');
      return;
    }

    console.log('\n🔄 Extracting utility functions...');
    
    const utilsFilePath = this.options.utilsFile;
    const utilsFile = this.project.createSourceFile(utilsFilePath, '', { overwrite: true });

    const extractedNames: string[] = [];
    const utilStatements: string[] = [];

    utilCandidates.forEach(candidate => {
      const varDecl = candidate.node.asKindOrThrow(SyntaxKind.VariableDeclaration);
      const varStatement = varDecl.getVariableStatement();
      
      if (varStatement) {
        // Get the full variable statement text
        const text = varStatement.getText();
        
        // Make it exported
        const exportedText = text.replace(/^(const|let|var)/, 'export const');
        
        utilStatements.push(exportedText);
        extractedNames.push(candidate.name);
        console.log(`  ✓ Extracted: ${candidate.name} (${candidate.lineCount} lines)`);
        
        // Remove from original
        varStatement.remove();
      }
    });

    // Build the complete utils file content
    const typeNames = this.getExportedTypeNames();
    const typeImport = typeNames.length > 0
      ? `import type { ${typeNames.join(', ')} } from '${toModuleSpecifier(utilsFilePath, this.options.typesFile)}';`
      : null;

    const utilsContent = [
      '/**',
      ' * Extracted utility functions',
      ' * Auto-generated by ts-morph refactoring script',
      ' */',
      '',
      ...(typeImport ? [typeImport, ''] : []),
      ...utilStatements,
    ].join('\n');

    utilsFile.replaceWithText(utilsContent);

    // Add import to original file
    if (extractedNames.length > 0) {
      const moduleSpecifier = toModuleSpecifier(this.options.targetFile, utilsFilePath);
      this.addOrUpdateNamedImport(moduleSpecifier, extractedNames);
    }

    utilsFile.saveSync();
    console.log(`  💾 Saved: ${path.basename(utilsFilePath)}`);
  }

  /**
   * Generate a report about the file
   */
  generateReport(candidates: ExtractionCandidate[]): void {
    console.log('\n📋 Extraction Candidates Report');
    console.log('================================');
    
    const grouped = candidates.reduce((acc, c) => {
      if (!acc[c.type]) acc[c.type] = [];
      acc[c.type].push(c);
      return acc;
    }, {} as Record<string, ExtractionCandidate[]>);

    Object.entries(grouped).forEach(([type, items]) => {
      console.log(`\n${type.toUpperCase()}S (${items.length}):`);
      items
        .sort((a, b) => b.lineCount - a.lineCount)
        .forEach(item => {
          const indicator = item.lineCount > 50 ? '🔴' : item.lineCount > 20 ? '🟡' : '🟢';
          console.log(`  ${indicator} ${item.name}: ${item.lineCount} lines`);
        });
    });

    const totalLines = candidates.reduce((sum, c) => sum + c.lineCount, 0);
    console.log(`\n📊 Total lines in candidates: ${totalLines}`);
  }

  /**
   * Save all changes
   */
  save(): void {
    this.sourceFile.saveSync();
    console.log('\n✅ Refactoring complete!');
    console.log('📁 Modified:', this.sourceFile.getFilePath());
  }

  /**
   * Helper: Get line count for a node
   */
  private getNodeLineCount(node: Node): number {
    const start = node.getStartLineNumber();
    const end = node.getEndLineNumber();
    return end - start + 1;
  }

  private addOrUpdateNamedImport(moduleSpecifier: string, names: string[]): void {
    const existingImport = this.sourceFile.getImportDeclaration(moduleSpecifier);
    if (existingImport) {
      const existingNames = existingImport.getNamedImports().map(imp => imp.getName());
      const mergedNames = Array.from(new Set([...existingNames, ...names]));
      existingImport.remove();
      this.sourceFile.addImportDeclaration({
        moduleSpecifier,
        namedImports: mergedNames,
      });
      return;
    }

    this.sourceFile.addImportDeclaration({
      moduleSpecifier,
      namedImports: names,
    });
  }

  private getExportedTypeNames(): string[] {
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
}

// Main execution
async function main() {
  console.log('🚀 TSX Refactoring Tool using ts-morph\n');

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const targetFile = args.file
    ? path.resolve(args.file)
    : path.join(__dirname, '..', 'src', 'components', 'UserManagementDashboard.tsx');

  const options: RefactorOptions = {
    targetFile,
    typesFile: path.resolve(args.types ?? resolveOutputPath(targetFile, '.types.ts')),
    utilsFile: path.resolve(args.utils ?? resolveOutputPath(targetFile, '.utils.ts')),
    minFunctionLines: Number.isFinite(args.minFunctionLines)
      ? Number(args.minFunctionLines)
      : DEFAULT_MIN_FUNCTION_LINES,
    minVariableLines: Number.isFinite(args.minVariableLines)
      ? Number(args.minVariableLines)
      : DEFAULT_MIN_VARIABLE_LINES,
    utilNamePattern: new RegExp(args.utilPattern ?? DEFAULT_UTIL_PATTERN),
  };

  const refactorer = new TSXRefactorer(options);
  
  // Step 1: Analyze
  const candidates = refactorer.analyzeFile();
  refactorer.generateReport(candidates);

  // Step 2: Extract types
  refactorer.extractTypes(candidates);

  // Step 3: Extract utilities
  refactorer.extractUtilities(candidates);

  // Step 4: Save
  refactorer.save();

  console.log('\n💡 Next steps:');
  console.log('  - Review the extracted files');
  console.log('  - Consider extracting more components (UserForm, UserTable)');
  console.log('  - Run npm run type-check to verify');
}

main().catch(console.error);
