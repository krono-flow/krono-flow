import Node from '../node/Node';

abstract class AbstractCommand {
  nodes: Node[];

  constructor(nodes: Node[]) {
    this.nodes = nodes;
  }

  abstract execute(): void;

  abstract undo(): void;
}

export default AbstractCommand;
