import AbstractNode from '../node/AbstractNode';

abstract class AbstractCommand {
  nodes: AbstractNode[];

  constructor(nodes: AbstractNode[]) {
    this.nodes = nodes;
  }

  abstract execute(): void;

  abstract undo(): void;
}

export default AbstractCommand;
