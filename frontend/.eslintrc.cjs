module.exports = {
  root: true,
  extends: ['eslint:recommended', 'prettier'],
  env: { node: true, browser: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
