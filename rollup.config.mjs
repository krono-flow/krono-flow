import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import glslify from 'rollup-plugin-glslify';
import postcss from 'rollup-plugin-postcss';
import terser from '@rollup/plugin-terser';

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
      {
        file: 'dist/index.mjs',
        ...publicConfig,
        format: 'es',
      },
      {
        file: 'dist/index.min.js',
        ...publicConfig,
        plugins: [
          terser(),
        ],
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
      {
        file: 'dist/decoder.min.js',
        format: 'umd',
        name: 'encoder',
        sourcemap: true,
        plugins: [
          terser(),
        ],
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
      {
        file: 'dist/encoder.min.js',
        format: 'umd',
        name: 'encoder',
        sourcemap: true,
        plugins: [
          terser(),
        ],
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
    input: 'src/style.less',
    output: {
      file: 'dist/style.min.css',
      sourcemap: true,
    },
    plugins: [
      postcss({
        extract: true,
        minimize: true,
      }),
    ],
  },
];
