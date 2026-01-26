import { RefreshLevel } from './level';
import AbstractNode from '../node/AbstractNode';

export function checkReflow(node: AbstractNode, lv: RefreshLevel) {
  const parent = node.parent!;
  if (lv & RefreshLevel.REMOVE_DOM) {
    node.didUnmount();
  }
  else if (lv & RefreshLevel.ADD_DOM) {
    node.layoutFlow(parent, parent.x, parent.y, parent.computedStyle.width, parent.computedStyle.height);
    if (lv & RefreshLevel.ADD_DOM) {
      node.didMount();
    }
  }
  else {
    const prevPosition = node.computedStyle.position;
    const nextPosition = node.style.position.v;
  }
}

export default {
  checkReflow,
};
