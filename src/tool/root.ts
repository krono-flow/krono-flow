import AbstractNode, { NodeType } from '../node/AbstractNode';
import Root from '../node/Root';
import Container from '../node/Container';
import { pointInRect } from '../math/geom';
import { MASK, VISIBILITY } from '../style/define';
import Component from '../node/Component';

function getChildByPoint(parent: Container, x: number, y: number, recursionComponent = false): AbstractNode | undefined {
  const children = parent.children;
  for (let i = children.length - 1; i >= 0; i--) {
    let child = children[i];
    let isComponent = false;
    if (child.type === NodeType.COMPONENT) {
      child = (child as Component).shadow!;
      // 可能为空，上面!只是防止报错
      if (!child) {
        if (!recursionComponent) {
          break;
        }
        continue;
      }
      isComponent = true;
    }
    const { matrixWorld } = child;
    if (!child.hasContent && child.type !== NodeType.CONTAINER
      || child.computedStyle.visibility === VISIBILITY.HIDDEN
      || !child.computedStyle.pointerEvents) {
      continue;
    }
    const rect = child.rect;
    const inRect = pointInRect(x, y, rect[0], rect[1], rect[2], rect[3], matrixWorld, true);
    // 在范围内继续递归子节点寻找，找不到返回自己
    if (inRect) {
      if (isComponent && !recursionComponent) {
        return children[i];
      }
      if (child.type === NodeType.CONTAINER) {
        const res = getChildByPoint(child as Container, x, y, recursionComponent);
        if (res) {
          return res;
        }
      }
      else {
        const prev = child.prev;
        // 点到mask上面优先
        if (prev && isInMask(prev, x, y)) {
          return prev;
        }
      }
      return child;
    }
    // 范围外也需要遍历子节点，子节点可能超出范围
    else if (!isComponent || recursionComponent) {
      if (child.type === NodeType.CONTAINER) {
        const res = getChildByPoint(child as Container, x, y, recursionComponent);
        if (res) {
          return res;
        }
      }
    }
  }
}

function isInMask(node: AbstractNode, x: number, y: number) {
  const computedStyle = node.computedStyle;
  if (computedStyle.maskMode !== MASK.NONE && computedStyle.pointerEvents) {
    const rect = node.rect;
    const matrixWorld = node.matrixWorld;
    return pointInRect(x, y, rect[0], rect[1], rect[2], rect[3], matrixWorld, true);
  }
  return false;
}

export function getNodeByPoint(root: Root, x: number, y: number, metaKey = false) {
  const res = getChildByPoint(root, x, y);
  if (metaKey) {}
  return res;
}
