# tsmorph

Automated TSX/TypeScript refactoring toolkit using [ts-morph](https://ts-morph.com/) to intelligently extract large code blocks (>150 LOC) into separate, well-typed, lint-compliant files with automatic import management.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run the complete refactoring pipeline
npm run refactor          # Extract types & interfaces
npm run refactor:pass2    # Extract utility functions  
npm run analyze-types     # Add missing types & improve type safety
npm run fix-lint          # Auto-fix lint issues & format code
npm run type-check        # Verify everything compiles
```

## ✨ Features

- **Automated Code Extraction**: Extracts types, interfaces, and utility functions to separate files
- **Smart Import Management**: Automatically adds, removes, and organizes imports
- **Type Analysis**: Infers and adds missing return types, parameter types, and fixes `any` types
- **Lint Auto-Fixing**: Integrates with ESLint and Prettier for consistent code quality
- **Type Safety**: Achieves 100% type coverage with precise union types

## 📊 Results

Starting with a monolithic **603-line** TSX component, the tools automatically refactor it into:

| File | LOC | Purpose |
|------|-----|---------|
| `UserManagementDashboard.tsx` | 532 | Main component logic |
| `UserManagementDashboard.types.ts` | 22 | Type definitions & interfaces |
| `UserManagementDashboard.utils.ts` | 50 | Utility functions with precise types |

All with:
- ✅ Automatically managed imports
- ✅ 100% type coverage  
- ✅ Lint-compliant code
- ✅ Precise union types (e.g., `"#ff6b6b" | "#4ecdc4" | "#95a5a6"`)

## 📖 Documentation

See [DOCUMENTATION.md](./DOCUMENTATION.md) for comprehensive guides on:
- How each refactoring tool works
- Customizing extraction patterns
- Type analysis details
- Configuration options
- Best practices

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run refactor` | Extract types and interfaces (pass 1) |
| `npm run refactor:pass2` | Extract utility functions (pass 2) |
| `npm run analyze-types` | Analyze and fix type annotations |
| `npm run fix-lint` | Auto-fix lint issues and format code |
| `npm run type-check` | Verify TypeScript compilation |
| `npm run lint` | Check for lint issues |
| `npm run format` | Format all files with Prettier |

## 📦 Example Output

### Type Analysis Report
```
📊 Type Analysis: UserManagementDashboard.utils.ts
  ✓ Added return type to getRoleBadgeColor: "#ff6b6b" | "#4ecdc4" | "#95a5a6" | "#7f8c8d"
  ✓ Added return type to getStatusBadgeColor: "#2ecc71" | "#e74c3c"
  ✓ Added return type to formatDate: string
  💾 Saved 3 type improvements

📈 Type Coverage Report: 100% (4/4 declarations typed)
  ✅ No 'any' types found
```

## 🎯 Key Technologies

- **ts-morph**: TypeScript AST manipulation
- **TypeScript**: Type inference and analysis
- **ESLint**: Code quality enforcement
- **Prettier**: Code formatting
- **ts-node**: Direct TypeScript execution

## 📝 License

MIT

