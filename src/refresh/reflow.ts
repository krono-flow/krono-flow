import { RefreshLevel } from './level';
import AbstractNode from '../node/AbstractNode';

export function checkReflow(node: AbstractNode, lv: RefreshLevel) {
  const parent = node.parent!;
  if (lv & RefreshLevel.REMOVE_DOM) {
    node.didUnmount();
  }
  // add和普通修改共用
  else {
    // node.layout({
    //   w: parent.computedStyle.width,
    //   h: parent.computedStyle.height,
    // });
    node.layoutFlow(parent.x, parent.y, parent.computedStyle.width, parent.computedStyle.height);
    if (lv & RefreshLevel.ADD_DOM) {
      node.didMount();
    }
  }
}

export default {
  checkReflow,
};
