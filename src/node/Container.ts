import AbstractNode, { NodeType } from './AbstractNode';
import Node from './Node';
import { Props } from '../format';
import { POSITION } from '../layout/define';
import { RefreshLevel } from '../refresh/level';
import inject from '../util/inject';
import { StyleUnit } from '../style/define';

class Container extends Node {
  children: AbstractNode[];

  constructor(props: Props, children: AbstractNode[] = []) {
    super(props);
    this.type = NodeType.CONTAINER;
    this.children = children;
  }

  override didMount() {
    super.didMount();
    const { children } = this;
    const len = children.length;
    if (len) {
      const first = children[0];
      first.parent = this;
      first.didMount();
      let last = first;
      for (let i = 1; i < len; i++) {
        const child = children[i];
        child.parent = this;
        last.next = child;
        child.prev = last;
        last = child;
        child.didMount();
      }
    }
  }

  override didUnmount() {
    super.didUnmount();
    this.children.forEach(item => {
      item.didUnmount();
    });
  }

  // override layout(x: number, y: number, w: number, h: number) {
  //   super.layout(x, y, w, h);
  //   const { children, style } = this;
  //   if (style.position.v === POSITION.ABSOLUTE) {
  //     this.layoutAbs(this, x, y, w, h); // root调用时自己就是parent
  //   }
  //   else {
  //     this.layoutFlow(x, y, w, h);
  //     // for (let i = 0, len = children.length; i < len; i++) {
  //     //   const child = children[i];
  //     //   // if (child.style.position )
  //     // }
  //   }
  //   // 递归下去布局
  //   // for (let i = 0, len = children.length; i < len; i++) {
  //   //   const child = children[i];
  //   //   child.layout({
  //   //     w: this.computedStyle.width,
  //   //     h: this.computedStyle.height,
  //   //   });
  //   // }
  // }

  override layoutFlow(x: number, y: number, w: number, h: number) {
    super.layoutFlow(x, y, w, h);
    const { children, style } = this;
    let hasAbsChild = false;
    let y1 = y;
    for (let i = 0, len = children.length; i < len; i++) {
      const child = children[i];
      if (child.style.position.v === POSITION.ABSOLUTE) {
        hasAbsChild = true;
      }
      else {
        child.layoutFlow(x, y1, w, h);
        y1 += child.computedStyle.height;
      }
    }
    if (style.height.v === StyleUnit.AUTO) {
      this.computedStyle.height = y1 - y;
    }
    const p = style.position.v;
    if (hasAbsChild && (p === POSITION.ABSOLUTE || p === POSITION.RELATIVE)) {
      for (let i = 0, len = children.length; i < len; i++) {
        const child = children[i];
        if (child.style.position.v === POSITION.ABSOLUTE) {
          child.layoutAbs(this, this._x, this._y, this.computedStyle.width, this.computedStyle.height);
        }
      }
    }
  }

  override layoutAbs(parent: Container, x: number, y: number, w: number, h: number) {
    super.layoutAbs(parent, x, y, w, h);
    const { children, style } = this;
    for (let i = 0, len = children.length; i < len; i++) {
      const child = children[i];
    }
  }

  override structure(lv: number) {
    let res = super.structure(lv);
    this.children.forEach((child) => {
      res = res.concat(child.structure(lv + 1));
    });
    res[0].num = this.children.length;
    res[0].total = res.length - 1;
    return res;
  }

  insertStruct(child: AbstractNode, childIndex: number) {
    const { struct, root } = this;
    const cs = child.structure(struct.lv + 1);
    const structs = root!.structs;
    let i;
    if (childIndex) {
      const s = this.children[childIndex - 1].struct;
      const total = s.total;
      i = structs.indexOf(s) + total + 1;
    }
    else {
      i = structs.indexOf(struct) + 1;
    }
    structs.splice(i, 0, ...cs);
    const total = cs[0].total + 1;
    struct.num++;
    struct.total += total;
    let p = this.parent;
    while (p) {
      p.struct.total += total;
      p = p.parent;
    }
  }

  deleteStruct(child: AbstractNode) {
    const cs = child.struct;
    const total = cs.total + 1;
    const root = this.root!,
      structs = root.structs;
    const i = structs.indexOf(cs);
    structs.splice(i, total);
    const struct = this.struct;
    struct.num--;
    struct.total -= total;
    let p = this.parent;
    while (p) {
      p.struct.total -= total;
      p = p.parent;
    }
  }

  appendChild(node: AbstractNode, cb?: (sync: boolean) => void) {
    node.remove();
    const { root, children } = this;
    const len = children.length;
    if (len) {
      const last = children[children.length - 1];
      last.next = node;
      node.prev = last;
    }
    node.parent = this;
    node.root = root;
    children.push(node);
    // 离屏情况，尚未添加到dom等
    if (!root || !this.isMounted) {
      cb && cb(true);
      return;
    }
    this.insertStruct(node, len);
    root.addUpdate(node, [], RefreshLevel.ADD_DOM, cb);
  }

  prependChild(node: AbstractNode, cb?: (sync: boolean) => void) {
    node.remove();
    const { root, children } = this;
    const len = children.length;
    if (len) {
      const first = children[0];
      first.next = node;
      node.prev = first;
    }
    node.parent = this;
    node.root = root;
    children.push(node);
    // 离屏情况，尚未添加到dom等
    if (!root || this.isDestroyed) {
      cb && cb(true);
      return;
    }
    this.insertStruct(node, 0);
    root.addUpdate(node, [], RefreshLevel.ADD_DOM, cb);
  }

  removeChild(node: AbstractNode, cb?: (sync: boolean) => void) {
    if (node.parent === this) {
      node.remove(cb);
    }
    else {
      inject.error('Invalid parameter of removeChild()');
    }
  }

  removeAllChildren(cb?: (sync: boolean) => void) {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (i) {
        this.children[i].remove();
      }
      else {
        this.children[i].remove(cb);
      }
    }
  }
}

export default Container;
