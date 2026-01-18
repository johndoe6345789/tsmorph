#!/usr/bin/env ts-node

import { Project, SourceFile, Node } from 'ts-morph';
import * as path from 'path';

/**
 * Type Analysis and Auto-fixing Tool using ts-morph
 * 
 * This script:
 * 1. Analyzes types in the refactored files
 * 2. Adds missing type annotations where they can be inferred
 * 3. Fixes incorrect or overly broad types (like 'any')
 * 4. Adds return types to functions
 * 5. Makes types more specific where possible
 */

interface CliArgs {
  files: string[];
  help?: boolean;
}

const parseArgs = (args: string[]): CliArgs => {
  const result: CliArgs = { files: [] };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;

    switch (arg) {
      case '--files': {
        const next = args[i + 1];
        if (next) {
          result.files.push(...next.split(',').map(entry => entry.trim()).filter(Boolean));
          i += 1;
        }
        break;
      }
      case '--file': {
        const next = args[i + 1];
        if (next) {
          result.files.push(next);
          i += 1;
        }
        break;
      }
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
  console.log(`\nUsage:\n  ts-node scripts/analyze-types.ts [options]\n\nOptions:\n  --file <path>            Single file to analyze (repeatable)\n  --files <a,b,c>          Comma-separated list of files to analyze\n  --help                   Show this help message\n`);
};

class TypeAnalyzer {
  private project: Project;

  constructor() {
    this.project = new Project({
      tsConfigFilePath: path.join(__dirname, '..', 'tsconfig.json'),
      compilerOptions: {
        strict: true,
        noImplicitAny: true,
      },
    });
  }

  /**
   * Add return type annotations to functions that are missing them
   */
  addReturnTypes(sourceFile: SourceFile): number {
    let fixCount = 0;
    
    // Find arrow functions without return types
    const variableDeclarations = sourceFile.getVariableDeclarations();
    
    variableDeclarations.forEach(decl => {
      const initializer = decl.getInitializer();
      
      if (initializer && Node.isArrowFunction(initializer)) {
        const returnType = initializer.getReturnType();
        const hasReturnType = initializer.getReturnTypeNode() !== undefined;
        
        if (!hasReturnType && returnType) {
          // Get the type text
          const typeText = returnType.getText(initializer);
          
          // Don't add 'void' or very complex types
          if (typeText !== 'void' && typeText.length < 100) {
            try {
              initializer.setReturnType(typeText);
              console.log(`    ✓ Added return type to ${decl.getName()}: ${typeText}`);
              fixCount++;
            } catch (e) {
              // Skip if it fails
            }
          }
        }
      }
    });

    // Find regular functions without return types
    const functions = sourceFile.getFunctions();
    functions.forEach(func => {
      const hasReturnType = func.getReturnTypeNode() !== undefined;
      
      if (!hasReturnType) {
        const returnType = func.getReturnType();
        const typeText = returnType.getText(func);
        
        if (typeText !== 'void' && typeText.length < 100) {
          try {
            func.setReturnType(typeText);
            console.log(`    ✓ Added return type to ${func.getName()}: ${typeText}`);
            fixCount++;
          } catch (e) {
            // Skip if it fails
          }
        }
      }
    });

    return fixCount;
  }

  /**
   * Add type annotations to parameters that are missing them
   */
  addParameterTypes(sourceFile: SourceFile): number {
    let fixCount = 0;

    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getVariableDeclarations()
        .map(v => v.getInitializer())
        .filter(init => init && Node.isArrowFunction(init))
        .map(init => init as any),
    ];

    functions.forEach(func => {
      if (!func.getParameters) return;
      
      const params = func.getParameters();
      
      params.forEach((param: any) => {
        const hasType = param.getTypeNode() !== undefined;
        
        if (!hasType) {
          const type = param.getType();
          const typeText = type.getText(param);
          
          // Only add if it's not 'any' and not too complex
          if (typeText !== 'any' && typeText.length < 100) {
            try {
              param.setType(typeText);
              console.log(`    ✓ Added type to parameter ${param.getName()}: ${typeText}`);
              fixCount++;
            } catch (e) {
              // Skip if it fails
            }
          }
        }
      });
    });

    return fixCount;
  }

  /**
   * Replace 'any' types with more specific types where possible
   */
  fixAnyTypes(sourceFile: SourceFile): number {
    let fixCount = 0;

    // Find all variables with 'any' type
    const variableDeclarations = sourceFile.getVariableDeclarations();
    
    variableDeclarations.forEach(decl => {
      const typeNode = decl.getTypeNode();
      
      if (typeNode && typeNode.getText() === 'any') {
        // Try to infer a better type from the initializer
        const initializer = decl.getInitializer();
        
        if (initializer) {
          const inferredType = initializer.getType();
          const typeText = inferredType.getText(initializer);
          
          if (typeText !== 'any' && typeText.length < 100) {
            try {
              decl.setType(typeText);
              console.log(`    ✓ Replaced 'any' with '${typeText}' for ${decl.getName()}`);
              fixCount++;
            } catch (e) {
              // Skip if it fails
            }
          }
        }
      }
    });

    return fixCount;
  }

  /**
   * Add missing type exports
   */
  ensureTypeExports(sourceFile: SourceFile): number {
    let fixCount = 0;

    // Check if this is a .types.ts file
    if (!sourceFile.getFilePath().includes('.types.ts')) {
      return 0;
    }

    // Find all interfaces and type aliases
    const interfaces = sourceFile.getInterfaces();
    const typeAliases = sourceFile.getTypeAliases();

    [...interfaces, ...typeAliases].forEach(type => {
      if (!type.isExported()) {
        type.setIsExported(true);
        console.log(`    ✓ Added export to type: ${type.getName()}`);
        fixCount++;
      }
    });

    return fixCount;
  }

  /**
   * Analyze and report type issues
   */
  analyzeTypes(sourceFile: SourceFile): void {
    console.log(`\n📊 Type Analysis: ${path.basename(sourceFile.getFilePath())}`);
    
    // Get diagnostics
    const diagnostics = sourceFile.getPreEmitDiagnostics();
    
    if (diagnostics.length === 0) {
      console.log('  ✅ No type errors found');
    } else {
      console.log(`  ⚠️  Found ${diagnostics.length} type issues:`);
      
      diagnostics.slice(0, 5).forEach(diag => {
        const message = diag.getMessageText();
        const line = diag.getLineNumber();
        console.log(`    Line ${line}: ${message}`);
      });
      
      if (diagnostics.length > 5) {
        console.log(`    ... and ${diagnostics.length - 5} more`);
      }
    }
  }

  /**
   * Improve type specificity
   */
  improveTypeSpecificity(sourceFile: SourceFile): number {
    let fixCount = 0;

    // Find string literal types that could be more specific
    const variableDeclarations = sourceFile.getVariableDeclarations();
    
    variableDeclarations.forEach(decl => {
      const initializer = decl.getInitializer();
      const typeNode = decl.getTypeNode();
      
      // If declared as 'string' but initializer is a string literal
      if (typeNode && typeNode.getText() === 'string' && initializer) {
        const initType = initializer.getType();
        
        if (initType.isStringLiteral()) {
          const literalValue = initType.getLiteralValue();
          
          // Check if it's a const
          const varStatement = decl.getVariableStatement();
          if (varStatement && varStatement.getDeclarationKind() === 'const') {
            // Can use literal type
            try {
              decl.setType(`'${literalValue}'`);
              console.log(`    ✓ Made type more specific for ${decl.getName()}: '${literalValue}'`);
              fixCount++;
            } catch (e) {
              // Skip if it fails
            }
          }
        }
      }
    });

    return fixCount;
  }

  /**
   * Process a single file
   */
  processFile(filePath: string): void {
    if (!require('fs').existsSync(filePath)) {
      console.log(`  ⏭️  File not found: ${filePath}`);
      return;
    }

    console.log(`\n📄 Processing: ${path.basename(filePath)}`);
    
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    
    let totalFixes = 0;

    // Step 1: Ensure type exports
    console.log('  🔍 Checking type exports...');
    totalFixes += this.ensureTypeExports(sourceFile);

    // Step 2: Add return types
    console.log('  🔍 Adding missing return types...');
    totalFixes += this.addReturnTypes(sourceFile);

    // Step 3: Add parameter types
    console.log('  🔍 Adding missing parameter types...');
    totalFixes += this.addParameterTypes(sourceFile);

    // Step 4: Fix 'any' types
    console.log('  🔍 Fixing any types...');
    totalFixes += this.fixAnyTypes(sourceFile);

    // Step 5: Improve type specificity
    console.log('  🔍 Improving type specificity...');
    totalFixes += this.improveTypeSpecificity(sourceFile);

    if (totalFixes > 0) {
      sourceFile.saveSync();
      console.log(`  💾 Saved ${totalFixes} type improvements`);
    } else {
      console.log('  ✅ No type improvements needed');
    }

    // Step 6: Analyze remaining type issues
    this.analyzeTypes(sourceFile);
  }

  /**
   * Process all refactored files
   */
  processAllFiles(filePaths?: string[]): void {
    const files = filePaths && filePaths.length > 0 ? filePaths : this.getDefaultFiles();
    files.forEach(file => this.processFile(file));
  }

  /**
   * Generate type coverage report
   */
  generateTypeCoverageReport(filePaths?: string[]): void {
    console.log('\n📈 Type Coverage Report');
    console.log('========================\n');

    const files = filePaths && filePaths.length > 0 ? filePaths : this.getDefaultFiles();

    files.forEach(filePath => {
      if (!require('fs').existsSync(filePath)) return;

      const sourceFile = this.project.addSourceFileAtPath(filePath);
      const fileName = path.basename(filePath);

      // Count typed vs untyped
      const allDeclarations = [
        ...sourceFile.getVariableDeclarations(),
        ...sourceFile.getFunctions(),
      ];

      let typedCount = 0;
      let untypedCount = 0;

      allDeclarations.forEach(decl => {
        if ('getTypeNode' in decl) {
          const hasType = decl.getTypeNode() !== undefined;
          if (hasType) {
            typedCount++;
          } else {
            untypedCount++;
          }
        }
      });

      const total = typedCount + untypedCount;
      const coverage = total > 0 ? Math.round((typedCount / total) * 100) : 100;

      console.log(`${fileName}:`);
      console.log(`  Type Coverage: ${coverage}% (${typedCount}/${total} declarations typed)`);
      
      // Check for 'any' usage
      const anyCount = sourceFile.getText().match(/:\s*any\b/g)?.length || 0;
      if (anyCount > 0) {
        console.log(`  ⚠️  Contains ${anyCount} 'any' types`);
      }
    });
  }

  private getDefaultFiles(): string[] {
    const componentsDir = path.join(__dirname, '..', 'src', 'components');
    return [
      path.join(componentsDir, 'UserManagementDashboard.types.ts'),
      path.join(componentsDir, 'UserManagementDashboard.utils.ts'),
      path.join(componentsDir, 'UserManagementDashboard.tsx'),
    ];
  }
}

async function main() {
  console.log('🚀 TypeScript Type Analysis and Auto-Fixing Tool\n');

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const analyzer = new TypeAnalyzer();
  
  // Process all files
  const files = args.files.map(file => path.resolve(file));
  analyzer.processAllFiles(files);

  // Generate report
  analyzer.generateTypeCoverageReport(files);

  console.log('\n✅ Type analysis complete!');
  console.log('\n💡 Next steps:');
  console.log('  - Run npm run type-check to verify all types');
  console.log('  - Review any remaining type issues');
}

main().catch(console.error);
