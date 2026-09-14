import js from '@eslint/js';
import reactNative from '@react-native/eslint-config/flat';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'lib/**',
      'node_modules/**',
      'artifacts/**',
      'example/android/**',
      'example/ios/**',
    ],
  },
  ...reactNative,
  {
    files: ['src/**/*.{ts,tsx}', 'example/src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        __DEV__: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      // Explicit void marks intentionally unawaited event-handler promises.
      'no-void': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // The example intentionally demonstrates dynamic inline theme styles.
      'react-native/no-inline-styles': 'off',
      '@typescript-eslint/no-require-imports': [
        'error',
        { allow: ['\\.(ttf|png|jpg|webp)$'] },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  prettier,
);
