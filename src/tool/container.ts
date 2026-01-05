import Node from '../node/Node';
import { RemoveData } from '../history/RemoveCommand';
import { clone } from '../util/type';
import { StyleUnit } from '../style/define';
import Container from '../node/Container';

export function appendWithPosAndSize(node: Node, data: RemoveData) {
  const { style, computedStyle } = node;
  const { x, y, parent, index } = data;
  // 原始单位记录下来
  const top = clone(style.top);
  const right = clone(style.right);
  const bottom = clone(style.bottom);
  const left = clone(style.left);
  const width = clone(style.width);
  const height = clone(style.height);
// 统一用左上+宽高来新定位
  style.left = {
    v: x,
    u: StyleUnit.PX,
  };
  style.right = {
    v: 0,
    u: StyleUnit.AUTO,
  };
  style.top = {
    v: y,
    u: StyleUnit.PX,
  };
  style.bottom = {
    v: 0,
    u: StyleUnit.AUTO,
  };
  style.width = {
    v: computedStyle.width,
    u: StyleUnit.PX,
  };
  style.height = {
    v: computedStyle.height,
    u: StyleUnit.PX,
  };
  appendWithIndex(parent, node, index);
  // 还原style原本的单位，需要重算一遍数值不能直接用已有的，因为%的情况parent可能发生了尺寸变化
  if (left.u === StyleUnit.PERCENT) {
    style.left = {
      v: computedStyle.left * 100 / parent.width,
      u: StyleUnit.PERCENT,
    };
  }
  else if (left.u === StyleUnit.PX) {
    style.left = {
      v: computedStyle.left,
      u: StyleUnit.PX,
    };
  }
  else if (left.u === StyleUnit.AUTO) {
    style.left = {
      v: 0,
      u: StyleUnit.AUTO,
    };
  }
  if (right.u === StyleUnit.PERCENT) {
    style.right = {
      v: computedStyle.right * 100 / parent.width,
      u: StyleUnit.PERCENT,
    };
  }
  else if (right.u === StyleUnit.PX) {
    style.right = {
      v: computedStyle.right,
      u: StyleUnit.PX,
    };
  }
  else if (right.u === StyleUnit.AUTO) {
    style.right = {
      v: 0,
      u: StyleUnit.AUTO,
    };
  }
  if (top.u === StyleUnit.PERCENT) {
    style.top = {
      v: computedStyle.top * 100 / parent.height,
      u: StyleUnit.PERCENT,
    };
  }
  else if (top.u === StyleUnit.PX) {
    style.top = {
      v: computedStyle.top,
      u: StyleUnit.PX,
    };
  }
  else if (top.u === StyleUnit.AUTO) {
    style.top = {
      v: 0,
      u: StyleUnit.AUTO,
    };
  }
  if (bottom.u === StyleUnit.PERCENT) {
    style.bottom = {
      v: computedStyle.bottom * 100 / parent.height,
      u: StyleUnit.PERCENT,
    };
  }
  else if (bottom.u === StyleUnit.PX) {
    style.bottom = {
      v: computedStyle.bottom,
      u: StyleUnit.PX,
    };
  }
  else if (bottom.u === StyleUnit.AUTO) {
    style.bottom = {
      v: 0,
      u: StyleUnit.AUTO,
    };
  }
  if (width.u === StyleUnit.PERCENT) {
    style.width = {
      v: computedStyle.width * 100 / parent.width,
      u: StyleUnit.PERCENT,
    };
  }
  else if (width.u === StyleUnit.PX) {
    style.width = {
      v: computedStyle.width,
      u: StyleUnit.PX,
    };
  }
  else if (width.u === StyleUnit.AUTO) {
    style.width = {
      v: 0,
      u: StyleUnit.AUTO,
    };
  }
  if (height.u === StyleUnit.PERCENT) {
    style.height = {
      v: computedStyle.height * 100 / parent.height,
      u: StyleUnit.PERCENT,
    };
  }
  else if (height.u === StyleUnit.PX) {
    style.height = {
      v: computedStyle.height,
      u: StyleUnit.PX,
    };
  }
  else if (height.u === StyleUnit.AUTO) {
    style.height = {
      v: 0,
      u: StyleUnit.AUTO,
    };
  }
}

export function appendWithIndex(parent: Container, node: Node, index: number) {
  const children = parent.children;
  if (index <= 0) {
    parent.prependChild(node);
  }
  else if (index >= children.length) {
    parent.appendChild(node);
  }
  else {
    children[index].insertAfter(node);
  }
}

export default {
  appendWithPosAndSize,
  appendWithIndex,
};
