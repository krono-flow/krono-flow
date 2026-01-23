import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import glslify from 'rollup-plugin-glslify';
import postcss from 'rollup-plugin-postcss';
import { wgsl } from './rollup.config.mjs';

const publicConfig = {
  format: 'iife',
  name: 'kronoFlow',
  sourcemap: true,
};

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        ...publicConfig,
      },
      {
        file: 'dist/index.mjs',
        ...publicConfig,
        format: 'es',
      },
    ],
    plugins: [
      nodeResolve({ preferBuiltins: false }),
      commonjs(),
      glslify(),
      wgsl,
      typescript({
        declaration: false,
        target: "ES2018",
      }),
      json(),
    ],
  },
  {
    input: 'src/decoder.ts',
    output: [
      {
        file: 'dist/decoder.js',
        format: 'es',
        name: 'encoder',
        sourcemap: true,
      },
    ],
    plugins: [
      nodeResolve({ preferBuiltins: false }),
      commonjs(),
      typescript({
        declaration: false,
        target: "ES2018",
      }),
      json(),
    ],
  },
  {
    input: 'src/encoder.ts',
    output: [
      {
        file: 'dist/encoder.js',
        format: 'es',
        name: 'encoder',
        sourcemap: true,
      },
    ],
    plugins: [
      nodeResolve({ preferBuiltins: false }),
      commonjs(),
      typescript({
        declaration: false,
        target: "ES2018",
      }),
      json(),
    ],
  },
  {
    input: 'src/style.less',
    output: {
      file: 'dist/style.css',
      sourcemap: true,
    },
    plugins: [
      postcss({
        extract: true,
      }),
    ],
  }
];
