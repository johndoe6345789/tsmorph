#!/usr/bin/env ts-node

import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Auto-fix linting issues in generated files
 * This runs ESLint --fix and Prettier on all extracted files
 */

class LintFixer {
  private project: Project;

  constructor() {
    this.project = new Project({
      tsConfigFilePath: path.join(__dirname, '..', 'tsconfig.json'),
    });
  }

  /**
   * Format a file using Prettier
   */
  formatFile(filePath: string): void {
    console.log(`  🎨 Formatting: ${path.basename(filePath)}`);
    try {
      execSync(`npx prettier --write "${filePath}"`, {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
      });
    } catch (e) {
      console.log(`    ⚠️  Prettier warning (non-critical)`);
    }
  }

  /**
   * Fix linting issues in a file
   */
  fixLinting(filePath: string): void {
    console.log(`  🔧 Fixing lint issues: ${path.basename(filePath)}`);
    try {
      execSync(`npx eslint --fix "${filePath}"`, {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
      });
    } catch (e) {
      // ESLint returns non-zero if there are unfixable issues
      console.log(`    ⚠️  Some lint issues may remain`);
    }
  }

  /**
   * Organize imports in a file using ts-morph
   */
  organizeImports(filePath: string): void {
    console.log(`  📦 Organizing imports: ${path.basename(filePath)}`);
    
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    
    // Get all import declarations
    const imports = sourceFile.getImportDeclarations();
    
    // Sort imports: React first, then libraries, then local
    const sortedImports = imports.sort((a, b) => {
      const aModule = a.getModuleSpecifierValue();
      const bModule = b.getModuleSpecifierValue();
      
      // React imports first
      if (aModule === 'react') return -1;
      if (bModule === 'react') return 1;
      
      // External packages (no . prefix)
      const aIsExternal = !aModule.startsWith('.');
      const bIsExternal = !bModule.startsWith('.');
      
      if (aIsExternal && !bIsExternal) return -1;
      if (!aIsExternal && bIsExternal) return 1;
      
      // Alphabetical within groups
      return aModule.localeCompare(bModule);
    });

    // Remove all imports
    imports.forEach(imp => imp.remove());
    
    // Add them back in sorted order
    sortedImports.forEach((imp, index) => {
      const structure = imp.getStructure();
      sourceFile.insertImportDeclaration(index, structure);
    });

    sourceFile.saveSync();
  }

  /**
   * Fix common TypeScript issues
   */
  fixCommonIssues(filePath: string): void {
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    
    // For now, skip unused import detection as it's complex
    // Just ensure the file is valid
    
    sourceFile.saveSync();
  }

  /**
   * Process all component files
   */
  processFiles(): void {
    console.log('\n🔍 Auto-fixing lint issues in refactored files...\n');

    const componentsDir = path.join(__dirname, '..', 'src', 'components');
    const files = [
      path.join(componentsDir, 'UserManagementDashboard.tsx'),
      path.join(componentsDir, 'UserManagementDashboard.types.ts'),
      path.join(componentsDir, 'UserManagementDashboard.utils.ts'),
    ];

    files.forEach(file => {
      if (require('fs').existsSync(file)) {
        console.log(`\n📄 Processing: ${path.basename(file)}`);
        
        // Step 1: Organize imports
        try {
          this.organizeImports(file);
        } catch (e) {
          console.log(`    ⚠️  Could not organize imports: ${e}`);
        }
        
        // Step 2: Fix common issues
        try {
          this.fixCommonIssues(file);
        } catch (e) {
          console.log(`    ⚠️  Could not fix common issues: ${e}`);
        }
        
        // Step 3: Format with Prettier
        this.formatFile(file);
        
        // Step 4: Fix with ESLint
        this.fixLinting(file);
        
        console.log(`  ✅ Done`);
      }
    });
  }
}

async function main() {
  console.log('🚀 Lint Auto-Fixer for Refactored Files\n');

  const fixer = new LintFixer();
  fixer.processFiles();

  console.log('\n✅ All files processed!');
  console.log('\n💡 Next steps:');
  console.log('  - Run npm run lint to check remaining issues');
  console.log('  - Run npm run type-check to verify TypeScript');
}

main().catch(console.error);
