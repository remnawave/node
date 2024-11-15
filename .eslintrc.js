module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'prisma/**'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-namespace': 'off',
    'linebreak-style': 0,
    'no-console': 'warn',
    'prettier/prettier': [
      'error',
      {
        bracketSpacing: true,
        tabWidth: 4,
        printWidth: 100,
        singleQuote: true,
        trailingComma: 'all',
        overrides: [
          {
            files: ['*.js', '*.jsx', '*.ts', '*.tsx'],
            options: {
              parser: 'typescript',
            },
          },
          {
            files: ['*.md', '*.json', '*.yaml', '*.yml'],
            options: {
              tabWidth: 2,
            },
          },
        ],
      },
    ],
  },
};
