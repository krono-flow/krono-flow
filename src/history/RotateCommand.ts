import UpdateStyleCommand from './UpdateStyleCommand';
import { RotateZStyle } from '../format';
import AbstractNode from '../node/AbstractNode';

export type RotateData = {
  prev: RotateZStyle;
  next: RotateZStyle;
};

class RotateCommand extends UpdateStyleCommand {
  constructor(nodes: AbstractNode[], data: RotateData[]) {
    super(nodes, data);
  }
}

export default RotateCommand;
