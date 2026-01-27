import { expect } from 'expect';
import krono from '../dist/index.js';

describe('Layout', () => {
  it('Flow static block by block', () => {
    const root = krono.parser.parseRoot({
      tagName: 'root',
      props: {
        style: {
          width: 100,
          height: 100,
        },
      },
      children: [
        {
          tagName: 'container',
          props: {
            uuid: 'c1',
            style: {
              position: 'static',
              height: 20,
            },
          },
        },
        {
          tagName: 'container',
          props: {
            uuid: 'c2',
            style: {
              position: 'static',
              height: '10%',
            },
          },
        },
      ],
    }, {
      headless: true,
    });
    expect(root.refs['c1'].x).toBe(0);
    expect(root.refs['c1'].y).toBe(0);
    expect(root.refs['c1'].width).toBe(100);
    expect(root.refs['c1'].height).toBe(20);
    expect(root.refs['c2'].x).toBe(0);
    expect(root.refs['c2'].y).toBe(20);
    expect(root.refs['c2'].width).toBe(100);
    expect(root.refs['c2'].height).toBe(10);
  });

  it('Flow absolute', () => {
    const root = krono.parser.parseRoot({
      tagName: 'root',
      props: {
        style: {
          width: 100,
          height: 100,
        },
      },
      children: [
        {
          tagName: 'container',
          props: {
            uuid: 'c1',
            style: {
              position: 'absolute',
              left: 10,
              top: 20,
              width: 30,
              height: 40,
            },
          },
        },
        {
          tagName: 'container',
          props: {
            uuid: 'c2',
            style: {
              position: 'absolute',
              left: 10,
              top: 20,
              height: '10%',
            },
          },
        },
        {
          tagName: 'container',
          props: {
            uuid: 'c3',
            style: {
              position: 'static',
              height: '10%',
            },
          },
        },
      ],
    }, {
      headless: true,
    });
    expect(root.refs['c1'].x).toBe(10);
    expect(root.refs['c1'].y).toBe(20);
    expect(root.refs['c1'].width).toBe(30);
    expect(root.refs['c1'].height).toBe(40);
    expect(root.refs['c2'].x).toBe(10);
    expect(root.refs['c2'].y).toBe(20);
    expect(root.refs['c2'].width).toBe(0);
    expect(root.refs['c2'].height).toBe(10);
    expect(root.refs['c3'].x).toBe(0);
    expect(root.refs['c3'].y).toBe(0);
    expect(root.refs['c3'].width).toBe(100);
    expect(root.refs['c3'].height).toBe(10);
  });
});
