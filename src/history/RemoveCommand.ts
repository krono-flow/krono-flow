import AbstractCommand from './AbstractCommand';
import Container from '../node/Container';
import AbstractNode from '../node/AbstractNode';
import { appendWithPosAndSize } from '../tool/container';

export type RemoveData = {
  x: number; // 位置即computedStyle的left/top，但删除节点会使得parent组的尺寸变化，left/top会不准确，记录时需修正
  y: number;
  parent: Container; // undo时添加需要父元素
  index: number; // 移除时在第几个child
};

class RemoveCommand extends AbstractCommand {
  data: RemoveData[];

  constructor(nodes: AbstractNode[], data: RemoveData[]) {
    super(nodes);
    this.data = data;
  }

  execute() {
    const { nodes } = this;
    nodes.forEach(node => {
      node.remove();
    });
  }

  undo() {
    const { nodes, data } = this;
    nodes.forEach((node, i) => {
      appendWithPosAndSize(node, data[i]);
    });
  }

  static operate(node: AbstractNode) {
    const parent = node.parent!;
    const index = parent.children.indexOf(node);
    const o: RemoveData = {
      x: node.computedStyle.left,
      y: node.computedStyle.top,
      parent,
      index,
    };
    node.remove();
    return o;
  }
}

export default RemoveCommand;
