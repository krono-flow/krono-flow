import AbstractNode, { ClientRect, NodeType, OffsetRect } from './AbstractNode';
import Node from './Node';
import { LayoutData } from '../refresh/layout';
import { Struct } from '../refresh/struct';
import { ComponentProps, JStyle } from '../format';
import { ComputedStyle, Style } from '../style/define';
import { RefreshLevel } from '../refresh/level';
import { EMPTY_RECT } from '../math/bbox';

export const PLACEHOLDER_NODE = new Node({
  uuid: 'PLACEHOLDER_NODE',
  name: 'PLACEHOLDER_NODE',
  style: {
    visibility: 'hidden',
    opacity: 0,
  },
});
PLACEHOLDER_NODE.layout({
  w: 0, h: 0,
});

class Component extends AbstractNode {
  private readonly _shadowRoot?: AbstractNode;
  private readonly _shadow?: Node;
  refs: Record<string, AbstractNode>;
  private readonly _float32Array!: Float32Array;
  private readonly _jStyle!: JStyle;
  private readonly _style!: Style;
  private readonly _computedStyle!: ComputedStyle;
  private readonly _clientRect!: ClientRect;
  private readonly _offsetRect!: OffsetRect;
  private readonly _struct!: Struct;

  declare props: ComponentProps;

  constructor(props: ComponentProps) {
    super(props);
    this.type = NodeType.COMPONENT;
    this.isComponent = true;
    this.refs = {};
    let sr = this._shadowRoot = this.render() || undefined;
    while (sr) {
      if (sr.isComponent) {
        sr = (sr as unknown as Component)._shadowRoot;
      }
      else if (sr.isNode) {
        this._shadow = sr as Node;
        break;
      }
    }
  }

  render(): AbstractNode | null | void | undefined {
  }

  didMount() {
    super.didMount();
    if (this._shadowRoot) {
      this._shadowRoot.host = this;
      this._shadowRoot.didMount();
    }
  }

  didUnmount() {
    super.didUnmount();
    if (this._shadowRoot) {
      this._shadowRoot.didUnmount();
    }
  }

  structure(lv: number) {
    if (this._shadow) {
      return this._shadow.structure(lv);
    }
    return [{
      node: PLACEHOLDER_NODE,
      num: 0,
      total: 0,
      lv,
      next: 0,
    }];
  }

  layout(data: LayoutData) {
    if (this._shadow) {
      this._shadow.layout(data);
    }
  }

  calReflowStyle() {
    if (this._shadow) {
      return this._shadow.calReflowStyle();
    }
  }

  calRepaintStyle(lv: RefreshLevel) {
    if (this._shadow) {
      return this._shadow.calRepaintStyle(lv);
    }
  }

  calMask() {
    if (this._shadow) {
      return this._shadow.calMask();
    }
  }

  calFilter(lv: RefreshLevel) {
    if (this._shadow) {
      return this._shadow.calFilter(lv);
    }
  }

  calMatrix(lv: RefreshLevel) {
    if (this._shadow) {
      return this._shadow.calMatrix(lv);
    }
  }

  calPerspective() {
    if (this._shadow) {
      return this._shadow.calPerspective();
    }
  }

  calPerspectiveSelf() {
    if (this._shadow) {
      return this._shadow.calPerspectiveSelf();
    }
  }

  calOpacity() {
    if (this._shadow) {
      return this._shadow.calOpacity();
    }
  }

  calContent() {
    if (this._shadow) {
      return this._shadow.calContent();
    }
  }

  calContentLoading() {
    if (this._shadow) {
      return this._shadow.calContentLoading();
    }
  }

  renderCanvas() {
    if (this._shadow) {
      this._shadow.renderCanvas();
    }
  }

  updateStyle(style: Partial<JStyle>, cb?: (sync: boolean) => void) {
    if (this._shadow) {
      this._shadow.updateStyle(style, cb);
    }
  }

  updateFormatStyle(style: Partial<Style>, cb?: (sync: boolean) => void) {
    if (this._shadow) {
      this._shadow.updateFormatStyle(style, cb);
    }
  }

  updateFormatStyleData(style: Partial<Style>) {
    if (this._shadow) {
      this._shadow.updateFormatStyleData(style);
    }
  }

  clearMask() {
    if (this._shadow) {
      this._shadow.clearMask();
    }
  }

  clearTexCache(includeSelf = false) {
    if (this._shadow) {
      this._shadow.clearTexCache(includeSelf);
    }
  }

  clearTexCacheUpward(includeSelf = false) {
    if (this._shadow) {
      this._shadow.clearTexCacheUpward(includeSelf);
    }
  }

  refresh(lv: RefreshLevel = RefreshLevel.REPAINT, cb?: (sync: boolean) => void) {
    if (this._shadow) {
      this._shadow.refresh(lv, cb);
    }
  }

  getStyle() {
    if (this._shadow) {
      return this._shadow.getStyle();
    }
    return this.style;
  }

  getComputedStyle() {
    if (this._shadow) {
      return this._shadow.getComputedStyle();
    }
    return this.computedStyle;
  }

  getCssStyle(standard = false) {
    if (this._shadow) {
      return this._shadow.getCssStyle(standard);
    }
    return this._jStyle;
  }

  clone() {
    return this;
  }

  getBoundingClientRect(opt?: {
    includeBbox?: boolean,
  }) {
    if (this._shadow) {
      return this._shadow.getBoundingClientRect(opt);
    }
    return this._clientRect;
  }

  getOffsetRect() {
    if (this._shadow) {
      return this._shadow.getOffsetRect();
    }
    return this._offsetRect;
  }

  startSizeChange() {
    if (this._shadow) {
      this._shadow.startSizeChange();
    }
  }

  endSizeChange(prev: Style) {
    if (this._shadow) {
      this._shadow.endSizeChange(prev);
    }
  }

  endPosChange(prev: Style, dx: number, dy: number) {
    if (this._shadow) {
      this._shadow.endPosChange(prev, dx, dy);
    }
  }

  adjustPosAndSizeSelf(dx1: number, dy1: number, dx2: number, dy2: number) {
    if (this._shadow) {
      this._shadow.adjustPosAndSizeSelf(dx1, dy1, dx2, dy2);
    }
  }

  checkPosSizeUpward() {
    if (this._shadow) {
      this._shadow.checkPosSizeUpward();
    }
  }

  adjustPosAndSize() {
    if (this._shadow) {
      return this._shadow.adjustPosAndSize();
    }
    return false;
  }

  get shadowRoot() {
    return this._shadowRoot;
  }

  get shadow() {
    return this._shadow;
  }

  get struct() {
    if (this._shadow) {
      return this._shadow._struct;
    }
    return this._struct;
  }

  get opacity() {
    if (this._shadow) {
      return this._shadow._opacity;
    }
    return 1;
  }

  set opacity(v: number) {
    if (this._shadow) {
      this._shadow._opacity = v;
    }
  }

  get transform() {
    if (this._shadow) {
      return this._shadow._transform;
    }
    return this._float32Array;
  }

  get matrix() {
    if (this._shadow) {
      return this._shadow._matrix;
    }
    return this._float32Array;
  }

  get matrixWorld() {
    if (this._shadow) {
      return this._shadow.matrixWorld;
    }
    return this._float32Array;
  }

  get perspectiveMatrix() {
    if (this._shadow) {
      return this._shadow._perspectiveMatrix;
    }
    return this._float32Array;
  }

  get perspectiveMatrixSelf() {
    if (this._shadow) {
      return this._shadow._perspectiveMatrixSelf;
    }
    return this._float32Array;
  }

  get rect() {
    if (this._shadow) {
      return this._shadow._rect;
    }
    return EMPTY_RECT;
  }

  get bbox() {
    if (this._shadow) {
      return this._shadow.bbox;
    }
    return EMPTY_RECT;
  }

  get filterBbox() {
    if (this._shadow) {
      return this._shadow.filterBbox;
    }
    return EMPTY_RECT;
  }

  get style() {
    if (this._shadow) {
      return this._shadow._style;
    }
    return this._style;
  }

  get computedStyle() {
    if (this._shadow) {
      return this._shadow._computedStyle;
    }
    return this._computedStyle;
  }

  get animationList() {
    if (this._shadow) {
      return this._shadow._animationList;
    }
    return [];
  }
}

export default Component;
