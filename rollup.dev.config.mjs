import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import glslify from 'rollup-plugin-glslify';
import postcss from 'rollup-plugin-postcss';

const publicConfig = {
  format: 'umd',
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
    ],
    plugins: [
      nodeResolve({ preferBuiltins: false }),
      commonjs(),
      glslify(),
      typescript({
        declaration: false,
        target: "ES5",
      }),
      json(),
    ],
  },
  {
    input: 'src/decoder.ts',
    output: [
      {
        file: 'dist/decoder.js',
        format: 'umd',
        name: 'encoder',
        sourcemap: true,
      },
    ],
    plugins: [
      nodeResolve({ preferBuiltins: false }),
      commonjs(),
      typescript({
        declaration: false,
        target: "ES5",
      }),
      json(),
    ],
  },
  {
    input: 'src/encoder.ts',
    output: [
      {
        file: 'dist/encoder.js',
        format: 'umd',
        name: 'encoder',
        sourcemap: true,
      },
    ],
    plugins: [
      nodeResolve({ preferBuiltins: false }),
      commonjs(),
      typescript({
        declaration: false,
        target: "ES5",
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
  },
  {
    input: 'demo/juchuang2aichuang.ts',
    output: [
      {
        file: 'demo/juchuang2aichuang.js',
        format: 'umd',
        name: 'juchuang2aichuang',
        sourcemap: true,
      },
    ],
    plugins: [
      nodeResolve({ preferBuiltins: false }),
      commonjs(),
      typescript({
        declaration: false,
        target: "ES5",
      }),
      json(),
    ],
  },
];
