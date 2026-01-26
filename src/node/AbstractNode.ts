import * as uuid from 'uuid';
import Event from '../util/Event';
import { JStyle, Props } from '../format';
import Root from './Root';
import Container from './Container';
import { ComputedStyle, Style } from '../style/define';
import { RefreshLevel } from '../refresh/level';
import AbstractAnimation from '../animation/AbstractAnimation';
import { Struct } from '../refresh/struct';
import Component from './Component';

export type ClientRect = OffsetRect & {
  width: number;
  height: number;
  points: { x: number, y: number }[];
};

export type OffsetRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export enum NodeType {
  ABSTRACT = 0, // 占位不应该出现
  NODE = 1,
  COMPONENT = 1,
  TEXT = 2,
  BITMAP = 3,
  AUDIO = 4,
  VIDEO = 5,
  LOTTIE = 6,
  ROOT = 7,
  CONTAINER = 8,
}

let id = 0;

abstract class AbstractNode extends Event {
  id: number;
  type: NodeType;
  isNode: boolean;
  isComponent: boolean;
  props: Props;
  uuid: string;
  name?: string;
  root?: Root;
  isLocked: boolean;
  parent?: Container;
  prev?: AbstractNode;
  next?: AbstractNode;
  mask?: AbstractNode;
  host?: Component;
  isMounted: boolean; // 是否在dom上
  isDestroyed: boolean; // 是否永久被销毁，手动调用
  refreshLevel: RefreshLevel;
  hasCacheOp: boolean; // 是否计算过世界opacity
  localOpId: number; // 同下面的matrix
  parentOpId: number;
  hasCacheMw: boolean; // 是否计算过世界matrix
  localMwId: number; // 当前计算后的世界matrix的id，每次改变自增
  parentMwId: number; // 父级的id副本，用以对比确认父级是否变动过
  hasContent: boolean; // 是否有内容需要渲染

  constructor(props: Props) {
    super();
    this.id = id++;
    this.type = NodeType.ABSTRACT;
    this.isNode = false;
    this.isComponent = false;
    this.props = props;
    this.uuid = props.uuid || uuid.v4();
    this.name = props.name;
    this.isLocked = !!props.isLocked;
    this.isMounted = false;
    this.isDestroyed = false;
    this.refreshLevel = RefreshLevel.REFLOW;
    this.hasCacheOp = false;
    this.localOpId = 0;
    this.parentOpId = 0;
    this.hasCacheMw = false;
    this.localMwId = 0;
    this.parentMwId = 0;
    this.hasContent = false;
  }

  didMount() {
    this.isMounted = true;
    const parent = this.parent;
    // 只有Root没有parent
    if (!parent) {
      return;
    }
    this.parentOpId = parent.localOpId;
    this.parentMwId = parent.localMwId;
    const root = (this.root = parent.root);
    const uuid = this.uuid;
    if (root && uuid) {
      root.refs[uuid] = this;
    }
  }

  didUnmount() {
    // 无论是否真实dom，都清空
    this.clearTexCache(true);
    this.isMounted = false;
    const root = this.root;
    const uuid = this.uuid;
    if (root && uuid) {
      delete root.refs[uuid];
    }
    this.animationList.forEach(item => {
      item.cancel();
      root!.aniController.removeAni(item);
    });
    this.prev = this.next = undefined;
    this.parent = this.root = undefined;
  }

  abstract structure(lv: number): Struct[];
  abstract layoutFlow(parent: Container, x: number, y: number, w: number, h: number): void
  abstract layoutAbs(parent: Container, x: number, y: number, w: number, h: number): void
  abstract calReflowStyle(): void;
  abstract calRepaintStyle(lv: RefreshLevel): void;
  abstract calMask(): void;
  abstract calFilter(lv: RefreshLevel): void;
  abstract calMatrix(lv: RefreshLevel): void;
  abstract calPerspective(): void;
  abstract calPerspectiveSelf(): void;
  abstract calOpacity(): void;
  abstract calContent(): void;
  abstract calContentLoading(): void;
  abstract renderCanvas(): void;
  abstract updateStyle(style: Partial<JStyle>, cb?: (sync: boolean) => void): RefreshLevel;
  abstract updateFormatStyle(style: Partial<Style>, cb?: (sync: boolean) => void): RefreshLevel;
  abstract updateFormatStyleData(style: Partial<Style>): (keyof Style)[];
  abstract clearMask(): void;
  abstract clearTexCache(includeSelf?: boolean): void;
  abstract clearTexCacheUpward(includeSelf?: boolean): void;
  abstract refresh(lv: RefreshLevel, cb?: ((sync: boolean) => void)): void;
  abstract getStyle(): Style;
  abstract getComputedStyle(): ComputedStyle;
  abstract getCssStyle(standard?: boolean): JStyle;

  isParent(target: AbstractNode) {
    let p = this.parent;
    while (p) {
      if (p === target) {
        return true;
      }
      p = p.parent;
    }
    return false;
  }

  isChild(target: AbstractNode) {
    return target.isParent(this);
  }

  // 插入node到自己后面
  insertAfter(node: AbstractNode, cb?: (sync: boolean) => void) {
    node.remove();
    const { root, parent } = this;
    if (!parent) {
      throw new Error('Can not appendSelf without parent');
    }
    node.parent = parent;
    node.prev = this;
    if (this.next) {
      this.next.prev = node;
    }
    node.next = this.next;
    this.next = node;
    node.root = root;
    const children = parent.children;
    const i = children.indexOf(this);
    children.splice(i + 1, 0, node);
    if (parent.isDestroyed) {
      cb && cb(true);
      return;
    }
    parent.insertStruct(node, i + 1);
    root!.addUpdate(node, [], RefreshLevel.ADD_DOM, cb);
  }

  // 插入node到自己前面
  insertBefore(node: AbstractNode, cb?: (sync: boolean) => void) {
    node.remove();
    const { root, parent } = this;
    if (!parent) {
      throw new Error('Can not prependBefore without parent');
    }
    node.parent = parent;
    node.prev = this.prev;
    if (this.prev) {
      this.prev.next = node;
    }
    node.next = this;
    this.prev = node;
    node.root = root;
    const children = parent.children;
    const i = children.indexOf(this);
    children.splice(i, 0, node);
    if (parent.isDestroyed) {
      cb && cb(true);
      return;
    }
    parent.insertStruct(node, i);
    root!.addUpdate(node, [], RefreshLevel.ADD_DOM, cb);
  }

  remove(cb?: (sync: boolean) => void) {
    const { root, parent } = this;
    if (parent) {
      const i = parent.children.indexOf(this);
      if (i === -1) {
        throw new Error('Invalid index of remove()');
      }
      parent.children.splice(i, 1);
      const { prev, next } = this;
      if (prev) {
        prev.next = next;
      }
      if (next) {
        next.prev = prev;
      }
      parent.deleteStruct(this);
    }
    // 未添加到dom时
    if (!root || !this.isMounted) {
      cb && cb(true);
      return;
    }
    root.addUpdate(this, [], RefreshLevel.REMOVE_DOM, cb);
  }

  abstract clone(): this;
  abstract getBoundingClientRect(opt?: {
    includeBbox?: boolean,
  }): ClientRect;
  abstract getOffsetRect(): OffsetRect;
  abstract startSizeChange(): void;
  abstract endSizeChange(prev: Style): void;
  abstract endPosChange(prev: Style, dx: number, dy: number): void;
  abstract adjustPosAndSizeSelf(dx1: number, dy1: number, dx2: number, dy2: number): void;
  abstract checkPosSizeUpward(): void;
  abstract adjustPosAndSize(): boolean;

  abstract get x(): number;
  abstract get y(): number;

  get width() {
    return this.computedStyle.width || 0;
  }

  get height() {
    return this.computedStyle.height || 0;
  }

  abstract get struct(): Struct;
  abstract get opacity(): number;
  abstract set opacity(v: number);
  abstract get transform(): Float32Array;
  abstract get matrix(): Float32Array;
  abstract get matrixWorld(): Float32Array;
  abstract get perspectiveMatrix(): Float32Array;
  abstract get perspectiveMatrixSelf(): Float32Array;
  abstract get rect(): Float32Array;
  abstract get bbox(): Float32Array;
  abstract get filterBbox(): Float32Array;
  abstract get style(): Style;
  abstract get computedStyle(): ComputedStyle;
  abstract get animationList(): AbstractAnimation[];
}

export default AbstractNode;
