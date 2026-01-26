import Node from '../Node';
import { Point, PolylineProps } from '../../format';
import { normalizePoints } from '../../style/css';
import { LayoutData } from '../../refresh/layout';
import { RefreshLevel } from '../../refresh/level';
import { buildPoints } from './point';
import { getPointsRect, resetBbox } from '../../math/bbox';
import { STROKE_POSITION } from '../../style/define';
import { lineCap, lineJoin } from './border';

class Polyline extends Node {
  coords?: number[][];
  points: Point[];
  isClosed: boolean;

  declare props: PolylineProps;

  constructor(props: PolylineProps) {
    super(props);
    this.props = props;
    this.points = [];
    props.points.forEach(item => {
      this.points.push(normalizePoints(item));
    });
    this.isClosed = props.isClosed || false;
  }

  override lay(x: number, y: number, w: number, h: number) {
    super.lay(x, y, w, h);
    this.coords = undefined;
  }

  override calRepaintStyle(lv: RefreshLevel) {
    super.calRepaintStyle(lv);
    this.coords = undefined;
    // bbox等父类设置了，矢量的变化会影响_rect
    this._rect = resetBbox(this._rect);
  }

  buildPoints() {
    if (this.coords) {
      return;
    }
    this.coords = buildPoints(this.points, this.isClosed, this.width, this.height);
  }

  override calContent() {
    this.buildPoints();
    return (this.hasContent = !!this.coords && this.coords.length > 1);
  }

  isLine() {
    this.buildPoints();
    const coords = this.coords;
    return (
      !!coords && coords.length === 2 && coords[0].length === 2 && coords[1].length === 2
    );
  }

  override refresh(lv: RefreshLevel = RefreshLevel.REPAINT, cb?: (sync: boolean) => void) {
    if (lv >= RefreshLevel.REPAINT) {
      this.coords = undefined;
    }
    super.refresh(lv, cb);
  }

  override renderCanvas() {
    super.renderCanvas();
    this.buildPoints();
    const coords = this.coords;
    if (!coords || !coords.length) {
      return;
    }
    this.renderFillStroke([coords], false);
  }

  override calRect() {
    // 可能不存在
    this.buildPoints();
    // 可能矢量编辑过程中超过或不足原本尺寸范围
    const coords = this.coords;
    if (coords && coords.length) {
      getPointsRect(coords, this._rect);
    }
  }

  override calBbox() {
    const bbox = this._bbox;
    this.buildPoints();
    const {
      strokeWidth,
      strokeEnable,
      strokePosition,
      strokeLinecap,
      strokeLinejoin,
      strokeMiterlimit,
    } = this.computedStyle;
    const isClosed = this.isClosed;
    // 所有描边最大值，影响bbox，可能链接点会超过原本的线粗范围
    let border = 0;
    strokeWidth.forEach((item, i) => {
      if (strokeEnable[i]) {
        // line很特殊，没有粗细高度，描边固定等同于center
        if (strokePosition[i] === STROKE_POSITION.OUTSIDE && isClosed) {
          border = Math.max(border, item);
        }
        else if (strokePosition[i] === STROKE_POSITION.CENTER || !isClosed) {
          border = Math.max(border, item * 0.5);
        }
      }
    });
    const minX = bbox[0] - border;
    const minY = bbox[1] - border;
    const maxX = bbox[2] + border;
    const maxY = bbox[3] + border;
    // lineCap仅对非闭合首尾端点有用
    if (!isClosed) {
      lineCap(bbox, border, this.coords || [], strokeLinecap);
    }
    // 闭合看lineJoin
    else {
      lineJoin(bbox, border, this.coords || [], strokeLinejoin, strokeMiterlimit);
    }
    bbox[0] = Math.min(bbox[0], minX);
    bbox[1] = Math.min(bbox[1], minY);
    bbox[2] = Math.max(bbox[2], maxX);
    bbox[3] = Math.max(bbox[3], maxY);
  }
}

export default Polyline;
