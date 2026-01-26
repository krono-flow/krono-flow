import expect from 'expect';
import krono from '../dist/index.mjs';

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
    expect(root.refs['c1'].computedStyle.width).toBe(100);
    expect(root.refs['c1'].computedStyle.height).toBe(20);
    expect(root.refs['c2'].x).toBe(0);
    expect(root.refs['c2'].y).toBe(20);
    expect(root.refs['c2'].computedStyle.width).toBe(100);
    expect(root.refs['c2'].computedStyle.height).toBe(10);
  });
});
