import AbstractCommand from './AbstractCommand';
import { ComputedStyle } from '../style/define';
import AbstractNode from '../node/AbstractNode';

export type MoveData = { dx: number, dy: number };

class MoveCommand extends AbstractCommand {
  data: MoveData[];

  constructor(nodes: AbstractNode[], data: MoveData[]) {
    super(nodes);
    this.data = data;
  }

  execute() {
    const { nodes, data } = this;
    nodes.forEach((node, i) => {
      const { dx, dy } = data[i];
      const originStyle = node.getStyle();
      const computedStyle = node.computedStyle;
      MoveCommand.operate(node, computedStyle, dx, dy);
      // 结束后特殊检查，translate换算布局，Group约束
      node.endPosChange(originStyle, dx, dy);
      node.checkPosSizeUpward();
    });
  }

  undo() {
    const { nodes, data } = this;
    nodes.forEach((node, i) => {
      const { dx, dy } = data[i];
      const originStyle = node.getStyle();
      const computedStyle = node.computedStyle;
      MoveCommand.operate(node, computedStyle, -dx, -dy);
      // 结束后特殊检查，translate换算布局，Group约束
      node.endPosChange(originStyle, -dx, -dy);
      node.checkPosSizeUpward();
    });
  }

  static operate(node: AbstractNode, computedStyle: ComputedStyle, dx: number, dy: number) {
    node.updateStyle({
      translateX: computedStyle.translateX + dx,
      translateY: computedStyle.translateY + dy,
    });
  }
}

export default MoveCommand;
