import { RefreshLevel } from './level';
import AbstractNode from '../node/AbstractNode';
import { POSITION } from '../style/define';

export function checkReflow(node: AbstractNode, lv: RefreshLevel) {
  if (lv & RefreshLevel.REMOVE_DOM) {
    node.didUnmount();
  }
  else {
    const root = node.root!;
    let parent = node.parent!;
    while (parent && parent !== root) {
      if ([POSITION.ABSOLUTE, POSITION.RELATIVE].includes(parent._computedStyle.position)) {
        break;
      }
    }
    if (node.style.position.v === POSITION.ABSOLUTE) {
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
