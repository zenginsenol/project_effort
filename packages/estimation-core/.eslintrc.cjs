/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@estimate-pro/eslint-config/base'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    'import/order': 'off',
  },
};
