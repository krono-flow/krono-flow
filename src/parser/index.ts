import Node from '../node/Node';
import Bitmap from '../node/Bitmap';

export function parseJSON(json: any) {
  const { tagName, props = {}, children = [], animation = [] } = json;
  if (!tagName) {
    throw new Error('Missing tagName');
  }
  if(!Array.isArray(children)) {
    throw new Error('Children must be an array');
  }
  if(!Array.isArray(animation)) {
    throw new Error('Animation must be an array');
  }
  let node: Node;
  if (tagName === 'img') {
    node = new Bitmap(props);
  }
  else {
    throw new Error('Unknown tagName');
  }
  return node;
}

export default {
  parseJSON,
};
