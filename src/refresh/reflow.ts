import { RefreshLevel } from './level';
import AbstractNode from '../node/AbstractNode';
import { POSITION } from '../style/define';

export function checkReflow(node: AbstractNode, lv: RefreshLevel) {
  if (lv & RefreshLevel.REMOVE_DOM) {
    node.didUnmount();
  }
  else if (lv & RefreshLevel.ADD_DOM) {
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
    node.didMount();
  }
  // 后续支持 TODO
  else {
    // const prevPosition = node.computedStyle.position;
    // const nextPosition = node.style.position.v;
  }
}

export default {
  checkReflow,
};
