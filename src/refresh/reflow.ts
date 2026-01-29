import { RefreshLevel } from './level';
import AbstractNode from '../node/AbstractNode';
import Component from '../node/Component';
import { Position } from '../style/define';

export function checkReflow(node: AbstractNode, lv: RefreshLevel) {
  if (lv & RefreshLevel.REMOVE_DOM) {
    node.didUnmount();
  }
  else {
    // 没实现render()的
    if (node.isComponent && !(node as Component).shadow) {
      return;
    }
    const root = node.root!;
    let parent = node.parent!;
    while (parent && parent !== root) {
      if ([Position.ABSOLUTE, Position.RELATIVE].includes(parent._computedStyle.position)) {
        break;
      }
    }
    if (node.style.position.v === Position.ABSOLUTE) {
      node.layoutAbs(parent, parent.x, parent.y, parent.computedStyle.width, parent.computedStyle.height);
    }
    else {
      node.layoutFlow(parent, parent.x, parent.y, parent.computedStyle.width, parent.computedStyle.height, false);
    }
    if (lv & RefreshLevel.ADD_DOM) {
      node.didMount();
    }
  }
}

export default {
  checkReflow,
};
