/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@estimate-pro/eslint-config/react'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-empty-object-type': 'off',
    'jsx-a11y/heading-has-content': 'off',
    'jsx-a11y/label-has-associated-control': 'off',
  },
};
