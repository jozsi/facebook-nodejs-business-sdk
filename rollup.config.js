import { nodeResolve } from '@rollup/plugin-node-resolve';
import { babel, getBabelOutputPlugin } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodePolyfills from 'rollup-plugin-polyfill-node';

const config = {
  input: 'src/bundle.es6',
  output: {
    file: 'test.js',
    format: 'es',
  },
  plugins: [
    nodePolyfills(),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
    }),
    babel({
      babelHelpers: 'bundled',
      presets: ['@babel/preset-flow'],
    }),
    commonjs({
      transformMixedEsModules: true,
    }),
    json(),
  ],
};

export default config;
