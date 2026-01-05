import Node from '../node/Node';
import { RefreshLevel } from './level';

export function checkReflow(node: Node, lv: RefreshLevel) {
  const parent = node.parent!;
  if (lv & RefreshLevel.REMOVE_DOM) {
    node.didUnmount();
  }
  // add和普通修改共用
  else {
    node.layout({
      w: parent.computedStyle.width,
      h: parent.computedStyle.height,
    });
    if (lv & RefreshLevel.ADD_DOM) {
      node.didMount();
    }
  }
}

export default {
  checkReflow,
};
