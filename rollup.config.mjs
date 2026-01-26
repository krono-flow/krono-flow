import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import glslify from 'rollup-plugin-glslify';
import postcss from 'rollup-plugin-postcss';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

export const wgsl = {
  name: 'wgsl-loader',
  transform(code, id) {
    if (id.endsWith('.wgsl')) {
      return {
        // 将 WGSL 源码转为 JS 字符串导出
        code: `export default ${JSON.stringify(code)};`,
        map: { mappings: '' }
      };
    }
  }
};

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'es',
        sourcemap: true,
      },
      {
        file: 'dist/index.iife.js',
        format: 'iife',
        sourcemap: true,
        name: 'kronoFlow',
      },
      {
        file: 'dist/index.min.js',
        format: 'iife',
        sourcemap: true,
        name: 'kronoFlow',
        plugins: [
          terser(),
        ],
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
        name: 'decoder',
        sourcemap: true,
      },
      {
        file: 'dist/decoder.min.js',
        format: 'es',
        name: 'decoder',
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
      {
        file: 'dist/encoder.min.js',
        format: 'es',
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
  // 归并 .d.ts 文件
  {
    input: 'types/index.d.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [
      // 将类型文件全部集中到一个文件中
      dts(),
    ],
  },
];
