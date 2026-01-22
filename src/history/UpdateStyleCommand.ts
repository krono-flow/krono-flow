import AbstractCommand from './AbstractCommand';
import { JStyle } from '../format';
import AbstractNode from '../node/AbstractNode';

export type UpdateStyleData = {
  prev: Partial<JStyle>;
  next: Partial<JStyle>;
};

class UpdateStyleCommand extends AbstractCommand {
  data: UpdateStyleData[];

  constructor(nodes: AbstractNode[], data: UpdateStyleData[]) {
    super(nodes);
    this.data = data;
  }

  execute() {
    const { nodes, data } = this;
    nodes.forEach((node, i) => {
      node.updateStyle(data[i].next);
    });
  }

  undo() {
    const { nodes, data } = this;
    nodes.forEach((node, i) => {
      node.updateStyle(data[i].prev);
    });
  }
}

export default UpdateStyleCommand;
