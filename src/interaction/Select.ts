import Node from '../node/Node';
import Root from '../node/Root';
import { VISIBILITY } from '../style/define';
import { calRectPoints, identity, multiply, multiplyScaleX, multiplyScaleY } from '../math/matrix';
import { r2d } from '../math/geom';

const html = `
  <div class="sub"></div>
  <span class="l">
    <b></b>
  </span>
  <span class="t">
    <b></b>
  </span>
  <span class="r">
    <b></b>
  </span>
  <span class="b">
    <b></b>
  </span>
  <span class="tl">
    <b></b>
  </span>
  <span class="tr">
    <b></b>
  </span>
  <span class="br">
    <b></b>
  </span>
  <span class="bl">
    <b></b>
  </span>
`;

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export default class Select {
  root: Root;
  dom: HTMLElement;
  select: HTMLElement;

  constructor(root: Root, dom: HTMLElement) {
    this.root = root;
    this.dom = dom;

    const select = this.select = document.createElement('div');
    select.className = 'select';
    select.style.display = 'none';
    select.innerHTML = html;
    dom.appendChild(select);
  }

  showSelect(selected: Node[]) {
    this.updateSelect(selected);
    this.select.style.display = 'block';
  }

  updateSelect(selected: Node[]) {
    const sub = this.select.querySelector('.sub') as HTMLElement;
    if (selected.length === 1) {
      sub.innerHTML = '';
      this.select.classList.remove('multi');
      if (selected[0].computedStyle.visibility === VISIBILITY.VISIBLE) {
        this.select.classList.remove('hide');
      }
      else {
        this.select.classList.add('hide');
      }
      const res = this.calRect(selected[0]);
      this.select.style.left = res.left + 'px';
      this.select.style.top = res.top + 'px';
      this.select.style.width = res.width + 'px';
      this.select.style.height = res.height + 'px';
      this.select.style.transform = res.transform;
    }
    // 多个时表现不一样，忽略了旋转镜像等transform，取所有节点的boundingClientRect全集
    else {}
  }

  // hover/select时单个节点的位置，包含镜像旋转等在内的transform，换算成dom的实际宽高尺寸
  calRect(node: Node) {
    const canvas = this.root.canvas!;
    let rect = node._rect || node.rect;
    let matrix = node.matrixWorld;
    const sx = canvas.clientWidth / canvas.width;
    const sy = canvas.clientHeight / canvas.height;
    if (sx !== 1 || sy !== 1) {
      const t = identity();
      matrix = multiply(t, matrix);
      multiplyScaleX(t, sx);
      multiplyScaleY(t, sy);
      matrix = multiply(t, matrix);
    }
    let { x1, y1, x2, y2, x3, y3, x4, y4 } = calRectPoints(rect[0], rect[1], rect[2], rect[3], matrix);
    // const flip = getFlipOnPage(node);
    // if (flip.x === -1) {
    //   [x1, x2] = [x2, x1];
    //   [y1, y2] = [y2, y1];
    //   [x3, x4] = [x4, x3];
    //   [y3, y4] = [y4, y3];
    // }
    // if (flip.y === -1) {
    //   [x1, x4] = [x4, x1];
    //   [y1, y4] = [y4, y1];
    //   [x2, x3] = [x3, x2];
    //   [y2, y3] = [y3, y2];
    // }
    const width = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    const height = Math.sqrt(Math.pow(x2 - x3, 2) + Math.pow(y2 - y3, 2));
    const res = {
      left: x1,
      top: y1,
      width,
      height,
      transform: '',
    };
    if (x2 > x1) {
      if (y2 !== y1) {
        const deg = r2d(Math.atan((y2 - y1) / (x2 - x1)));
        res.transform = `rotateZ(${deg}deg)`;
      }
    }
    else if (x2 < x1) {
      const deg = r2d(Math.atan((y2 - y1) / (x2 - x1)));
      res.transform = `rotateZ(${deg + 180}deg)`;
    }
    else {
      if (y2 > y1) {
        res.transform = `rotateZ(90deg)`;
      }
      else if (y2 < y1) {
        res.transform = `rotateZ(-90deg)`;
      }
    }
    return res;
  }

  hideSelect() {
    this.select.style.display = 'none';
  }

  release() {
    this.select.remove();
  }

  metaKey(meta: boolean) {
    if (meta) {
      this.select.classList.add('rotate');
    }
    else {
      this.select.classList.remove('rotate');
    }
  }

  isSelectControlDom(dom: HTMLElement) {
    return dom.parentElement === this.select;
  }

  getAspectRatio() {
    const style = this.select.style;
    return {
      x: parseFloat(style.left),
      y: parseFloat(style.top),
      w: parseFloat(style.width),
      h: parseFloat(style.height),
    };
  }
};
