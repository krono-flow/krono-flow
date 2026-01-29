import Event from '../util/Event';
import AbstractNode, { NodeType } from '../node/AbstractNode';
import Text from '../node/Text';
import Root from '../node/Root';
import Select, { Rect } from './Select';
import { State } from './state';
import interactionEvent, { CONTENT, CURSOR, STATE_CHANGE } from './interactionEvent';
import { ComputedStyle, Style, StyleUnit } from '../style/define';
import History from '../history/History';
import MoveCommand, { MoveData } from '../history/MoveCommand';
import RemoveCommand, { RemoveData } from '../history/RemoveCommand';
import AbstractCommand from '../history/AbstractCommand';
import ResizeCommand, { CONTROL_TYPE, ResizeData } from '../history/ResizeCommand';
import RotateCommand from '../history/RotateCommand';
import { intersectLineLine } from '../math/isec';
import { JStyle } from '../format';
import { angleBySides, r2d } from '../math/geom';
import { crossProduct } from '../math/vector';
import { getNodeByPoint } from '../tool/root';
import Input from './Input';
import TextCommand from '../history/TextCommand';

export type ListenerOptions = {
  disabled?: {
    rotate?: boolean;
  },
};

const isWin = typeof navigator !== 'undefined' && /win/i.test(navigator.platform);

class Listener extends Event {
  root: Root;
  dom: HTMLElement;
  options?: ListenerOptions;
  state: State;
  isMouseDown: boolean;
  isMouseMove: boolean;
  originX: number; // dom原点page坐标，每次按下更新
  originY: number;
  startX: number; // 按下时page坐标，减去origin即为相对于原点的坐标
  startY: number;
  centerX: number; // 单个节点拖转旋转时节点的中心
  centerY: number;
  metaKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  eventListenerList: { type: string, cb: any }[];
  history: History;
  selected: AbstractNode[]; // 已选的节点们
  select: Select; // 展示的选框dom
  computedStyle: ComputedStyle[]; // 点击按下时已选节点的值样式状态记录初始状态，拖动过程中对比计算
  originStyle: Style[]; // 同上
  cssStyle: JStyle[]; // 同上
  input: Input; // 输入文字dom和文本光标
  dx: number;  // 每次拖拽的px，考虑缩放和dpi，即为canvas内的单位
  dy: number;
  isControl: boolean; // 调整尺寸
  isRotate: boolean; // 是否在旋转中
  controlType: CONTROL_TYPE; // 拖动尺寸dom时节点的class，区分比如左拉还是右拉
  selectRect?: Rect; // 多个节点拉伸时最初的选框信息
  clientRect?: Rect[]; // 和select一样记录每个节点最初的选框信息

  constructor(root: Root, dom: HTMLElement, options: ListenerOptions) {
    super();
    this.root = root;
    this.dom = dom;
    this.options = options;
    this.state = State.NORMAL;
    this.isMouseDown = false;
    this.isMouseMove = false;
    this.originX = 0;
    this.originY = 0;
    this.startX = 0;
    this.startY = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.metaKey = false;
    this.shiftKey = false;
    this.ctrlKey = false;
    this.altKey = false;
    this.eventListenerList = [
      { type: 'mousedown',    cb: this.onMouseDown.bind(this) },
      { type: 'mousemove',    cb: this.onMouseMove.bind(this) },
      { type: 'mouseup',      cb: this.onMouseUp.bind(this) },
      { type: 'dblclick',     cb: this.onDblClick.bind(this) },
      { type: 'keydown',      cb: this.onKeyDown.bind(this) },
      { type: 'keyup',        cb: this.onKeyUp.bind(this) },
    ];
    this.eventListenerList.forEach(item => {
      if (item.type === 'keydown' || item.type === 'keyup') {
        document.addEventListener(item.type, item.cb);
      }
      else {
        dom.addEventListener(item.type, item.cb);
      }
    });
    this.history = new History();
    this.selected = [];
    this.select = new Select(root, dom);
    this.computedStyle = [];
    this.originStyle = [];
    this.cssStyle = [];
    this.input = new Input(root, dom, this);
    this.dx = 0;
    this.dy = 0;
    this.isControl = false;
    this.isRotate = false;
    this.controlType = CONTROL_TYPE.T;
  }

  // 更新dom的位置做原点坐标，鼠标按下或touch按下时
  updateOrigin() {
    const o = this.dom.getBoundingClientRect();
    this.originX = o.left;
    this.originY = o.top;
  }

  prepare() {
    const selected = this.selected;
    this.computedStyle = selected.map((item) => item.getComputedStyle());
    this.originStyle = selected.map((item) => item.getStyle());
  }

  getNode(x: number, y: number, isDbl = false) {
    let meta = this.metaKey || isWin && this.ctrlKey;
    return getNodeByPoint(this.root, x, y, meta, this.selected, isDbl);
  }

  onMouseDown(e: MouseEvent) {
    if (e.button !== 0) {
      return;
    }
    const selected = this.selected;
    this.isMouseDown = true;
    this.updateOrigin();
    this.startX = (e.clientX - this.originX);
    this.startY = (e.clientY - this.originY);
    const canvas = this.root.canvas!;
    const x = this.startX * canvas.width / canvas.clientWidth;
    const y = this.startY * canvas.height / canvas.clientHeight;
    const target = e.target as HTMLElement;
    const isControl = this.isControl = this.select.isSelectControlDom(target);
    // 点到控制html上
    if (isControl) {
      if (this.state === State.EDIT_TEXT) {
        this.cancelEditText();
      }
      const controlType = this.controlType = {
        't': CONTROL_TYPE.T,
        'r': CONTROL_TYPE.R,
        'b': CONTROL_TYPE.B,
        'l': CONTROL_TYPE.L,
        'tl': CONTROL_TYPE.TL,
        'tr': CONTROL_TYPE.TR,
        'bl': CONTROL_TYPE.BL,
        'br': CONTROL_TYPE.BR,
      }[target.className]!;
      this.prepare();
      const metaKey = this.metaKey || isWin && this.ctrlKey;
      // 旋转时记住中心坐标
      if (!this.options?.disabled?.rotate && selected.length === 1 && metaKey && [
        CONTROL_TYPE.TL, CONTROL_TYPE.TR, CONTROL_TYPE.BL, CONTROL_TYPE.BR,
      ].indexOf(controlType) > -1) {
        const { points } = selected[0].getBoundingClientRect();
        const i = intersectLineLine(
          points[0].x, points[0].y, points[2].x, points[2].y,
          points[1].x, points[1].y, points[3].x, points[3].y,
        )!;
        this.centerX = i.x * canvas.clientWidth / canvas.width;
        this.centerY = i.y * canvas.clientHeight / canvas.height;
        this.isRotate = true;
      }
      // 调整尺寸
      else {
        this.beforeResize();
      }
    }
    else {
      const node = this.getNode(x, y);
      const oldSelected = selected.slice(0);
      if (node) {
        const i = selected.indexOf(node);
        // 点选已选节点
        if (i > -1) {
          // 编辑text状态是更新光标
          if (this.state === State.EDIT_TEXT) {
            const text = node as Text;
            if (this.shiftKey) {
              text.setCursorEndByAbsCoords(x, y);
              text.inputStyle = undefined;
              this.input.hideCursor();
            }
            else {
              const { isMulti, startLineBox, startTextBox, startString } = text.cursor;
              text.resetCursor();
              const p = text.setCursorStartByAbsCoords(x, y);
              this.input.updateCursor(p);
              this.input.showCursor();
              // 没有变化不触发事件，换行可能start相同所以用3个属性对比
              if (text.cursor.isMulti === isMulti
                && text.cursor.startLineBox === startLineBox
                && text.cursor.startTextBox === startTextBox
                && text.cursor.startString === startString) {
                return;
              }
            }
            this.emit(CURSOR, [text]);
            return;
          }
        }
        // 点选新节点
        else {
          if (this.state === State.EDIT_TEXT) {
            this.cancelEditText(oldSelected[0]);
            return;
          }
          if (!this.shiftKey) {
            selected.splice(0);
          }
          // 多选，但要排除父子规则，已选择子祖父全忽略，已选择祖父再选子依旧忽略祖父
          else {
            for (let i = selected.length - 1; i >= 0; i--) {
              const item = selected[i];
              if (node.isParent(item)) {
                selected.splice(i, 1);
              }
              else if (node.isChild(item)) {
                return;
              }
            }
          }
          selected.push(node);
        }
      }
      else {
        if (this.state === State.EDIT_TEXT) {
          this.cancelEditText(oldSelected[0]);
          return;
        }
        selected.splice(0);
      }
      this.updateActive(true);
    }
  }

  onMouseMove(e: MouseEvent) {
    const canvas = this.root.canvas!;
    let dx = e.clientX - this.originX - this.startX; // 外部页面单位
    let dy = e.clientY - this.originY - this.startY;
    let dx2 = this.dx = dx * canvas.width / canvas.clientWidth; // 画布内单位
    let dy2 = this.dy = dy * canvas.height / canvas.clientHeight;
    const selected = this.selected;
    // 操作控制尺寸的时候，已经mousedown了
    if (this.isControl) {
      // 防手抖功能，按下的瞬间可能有轻微移动，会干扰，甚至会出现dx/dy都是0的干扰
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && !this.isMouseMove) {
        return;
      }
      // 特殊单个节点旋转操控，知道节点中心坐标，点击初始坐标，移动后坐标，3点确定三角形，余弦定理求夹角
      if (this.isRotate) {
        const cx = this.centerX;
        const cy = this.centerY;
        const ax = this.startX;
        const ay = this.startY;
        const bx = e.clientX - this.originX;
        const by = e.clientY - this.originY;
        const r = angleBySides(
          Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2)),
          Math.sqrt(Math.pow(cx - bx, 2) + Math.pow(cy - by, 2)),
          Math.sqrt(Math.pow(ax - cx, 2) + Math.pow(ay - cy, 2)),
        );
        let deg = r2d(r);
        // 知道角度后需确定顺逆时针方向
        const c = crossProduct(
          ax - cx, ay - cy,
          bx - cx, by - cy,
        );
        if (this.shiftKey) {
          for (let i = 0; i <= 180; i+= 15) {
            if (Math.abs(deg - i) <= 7.5) {
              deg = i;
              break;
            }
          }
        }
        const node = selected[0];
        const rotateZ = (this.computedStyle[0].rotateZ + deg * (c >= 0 ? 1 : -1)) % 360;
        node.updateStyle({
          rotateZ,
        });
        this.select.updateSelect(selected);
        this.emit(interactionEvent.ROTATE, selected.slice(0));
      }
      // 普通的节点拉伸
      else {
        const shiftKey = this.shiftKey;
        const altKey = this.altKey;
        const controlType = this.controlType;
        selected.forEach((node, i) => {
          // 改变尺寸前置记录操作，注意更新computedStyle（startSizeChange变更了），影响计算
          if (!this.isMouseMove) {
            node.startSizeChange();
            this.computedStyle[i] = node.getComputedStyle();
            this.cssStyle[i] = node.getCssStyle();
          }
          const computedStyle = this.computedStyle[i];
          const cssStyle = this.cssStyle[i];
          // 多个节点拉伸时，按选框进行缩放和保持相对位置
          if (this.selectRect && this.clientRect && this.clientRect[i]) {
            ResizeCommand.operateMultiAr(node, computedStyle, cssStyle, dx2, dy2, controlType, this.clientRect[i], this.selectRect, shiftKey, altKey);
          }
          // 普通拉伸
          else {
            ResizeCommand.operate(node, computedStyle, cssStyle, dx2, dy2, controlType, shiftKey, altKey);
          }
        });
        this.select.updateSelect(selected);
        this.emit(interactionEvent.RESIZE, selected.slice(0));
      }
      this.isMouseMove = true;
    }
    else if (this.isMouseDown) {
      // 防手抖功能，按下的瞬间可能有轻微移动，会干扰，甚至会出现dx/dy都是0的干扰
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && !this.isMouseMove) {
        return;
      }
      this.isMouseMove = true;
      if (this.state === State.EDIT_TEXT) {
        const x = (e.clientX - this.originX) * canvas.width / canvas.clientWidth;
        const y = (e.clientY - this.originY) * canvas.height / canvas.clientHeight;
        const text = selected[0] as Text;
        const { isMulti, start, end } = text.cursor;
        text.setCursorEndByAbsCoords(x, y);
        this.input.hideCursor();
        const cursor = text.cursor;
        if (isMulti !== cursor.isMulti || start !== cursor.start || end !== cursor.end) {
          this.emit(CURSOR, selected.slice(0));
        }
      }
      else {
        this.select.select.classList.add('move');
        // 水平/垂直
        if (this.shiftKey) {
          if (Math.abs(dx2) >= Math.abs(dy2)) {
            this.dy = dy = dy2 = 0;
          }
          else {
            this.dx = dx = dx2 = 0;
          }
        }
        selected.forEach((node, i) => {
          const computedStyle = this.computedStyle[i];
          /**
           * 这里用computedStyle的translate差值做计算，得到当前的translate的px值updateStyle给node，
           * 在node的calMatrix那里是优化过的计算方式，只有translate变更的话也是只做差值计算，更快。
           * 需要注意目前matrix的整体计算是将布局信息TRLB换算为translate，因此style上的原始值和更新的这个px值并不一致，
           * 结束拖动调用endPosChange()将translate写回布局TRLB的style上满足定位要求。
           */
          MoveCommand.operate(node, computedStyle, dx2, dy2);
        });
        this.select.updateSelect(selected);
        this.emit(interactionEvent.MOVE, selected.slice(0));
      }
    }
  }

  onMouseUp() {
    const selected = this.selected;
    const { dx, dy } = this;
    if (this.isControl) {
      if (this.isRotate) {
        const node = selected[0];
        if (dx || dy) {
          this.history.addCommand(new RotateCommand([node], [{
            prev: {
              rotateZ: this.computedStyle[0].rotateZ,
            },
            next: {
              rotateZ: node.computedStyle.rotateZ,
            },
          }]), true);
        }
      }
      else {
        if (this.isMouseMove) {
          const shiftKey = this.shiftKey;
          const altKey = this.altKey;
          const controlType = this.controlType;
          const data: ResizeData[] = [];
          selected.forEach((node, i) => {
            // 还原最初的translate/TRBL值，就算没移动也要还原，因为可能是移动后恢复原位，或者translate单位改变
            node.endSizeChange(this.originStyle[i]);
            if (dx || dy) {
              const rd: ResizeData = { dx, dy, controlType, aspectRatio: shiftKey, clientRect: this.clientRect && this.clientRect[i], selectRect: this.selectRect, fromCenter: altKey };
              const originStyle = this.originStyle[i];
              if (originStyle.width.u === StyleUnit.AUTO) {
                rd.widthFromAuto = true;
              }
              if (originStyle.height.u === StyleUnit.AUTO) {
                rd.heightFromAuto = true;
              }
              data.push(rd);
            }
          });
          if (data.length) {
            this.history.addCommand(new ResizeCommand(selected.slice(0), data));
          }
        }
      }
    }
    else if (this.isMouseMove) {
      if (this.state === State.EDIT_TEXT) {
        const text = selected[0] as Text;
        const multi = text.checkCursorMulti();
        // 可能框选的文字为空不是多选，需取消
        if (!multi) {
          this.input.updateCursor();
          this.input.showCursor();
        }
        else {
          this.input.hideCursor();
        }
        this.input.focus();
      }
      else {
        this.select.select.classList.remove('move');
        const { dx, dy } = this;
        const data: MoveData[] = [];
        selected.forEach((node, i) => {
          // 还原最初的translate/TRBL值，就算没移动也要还原，因为可能是移动后恢复原位，或者translate单位改变
          if (dx || dy) {
            node.endPosChange(this.originStyle[i], dx, dy);
            data.push({ dx, dy });
          }
        });
        if (data.length) {
          this.history.addCommand(new MoveCommand(selected.slice(0), data), true);
        }
      }
    }
    this.isControl = false;
    this.isRotate = false;
    this.isMouseDown = false;
    this.isMouseMove = false;
  }

  onDblClick(e: MouseEvent) {
    if (e.button !== 0) {
      return;
    }
    const canvas = this.root.canvas!;
    const x = this.startX * canvas.width / canvas.clientWidth;
    const y = this.startY * canvas.height / canvas.clientHeight;
    const node = this.getNode(x, y);
    // 双击优先唯一选择此节点
    if (this.selected.length !== 1 || node !== this.selected[0]) {
      this.selected.splice(0);
      node && this.selected.push(node);
      this.updateActive(true);
    }
    // 已是唯一节点Text双击后进入编辑模式
    else if (node.type === NodeType.TEXT) {
      this.input.show(node as Text, x, y);
      (node as Text).beforeEdit();
      const old = this.state;
      this.state = State.EDIT_TEXT;
      this.select.select.classList.add('text');
      this.emit(STATE_CHANGE, old, this.state);
    }
  }

  onKeyDown(e: KeyboardEvent) {
    this.metaKey = e.metaKey;
    this.altKey = e.altKey;
    this.ctrlKey = e.ctrlKey;
    this.shiftKey = e.shiftKey;
    const metaKey = (this.metaKey || isWin && this.ctrlKey);
    if (!this.options?.disabled?.rotate && metaKey && this.selected.length === 1) {
      this.select.metaKey(true);
    }
    const { keyCode, code } = e;
    const target = e.target as HTMLElement; // 忽略输入时
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName.toUpperCase());
    // backspace/delete
    if (keyCode === 8 || keyCode === 46 || code === 'Backspace' || code === 'Delete') {
      if (isInput) {
        return;
      }
      this.removeNode();
    }
    // esc，优先隐藏颜色picker，再编辑文字回到普通，普通取消选择
    else if (keyCode === 27 || code === 'Escape') {
      if (this.state === State.EDIT_TEXT) {
        this.cancelEditText();
      }
      else {
        this.selected.splice(0);
        this.select.hideSelect();
        this.emit(interactionEvent.SELECT, []);
      }
    }
    // 移动，普通的节点移动和矢量顶点侦听，文字光标是特殊的聚焦input框侦听
    else if (keyCode >= 37 && keyCode <= 40 || ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(code)) {
      if (isInput) {
        return;
      }
      e.preventDefault();
      let x = 0;
      let y = 0;
      if (keyCode === 37) {
        if (this.shiftKey) {
          x = -10;
        }
        else if (this.altKey) {
          x = -0.1;
        }
        else {
          x = -1;
        }
      }
      else if (keyCode === 38) {
        if (this.shiftKey) {
          y = -10;
        }
        else if (this.altKey) {
          y = -0.1;
        }
        else {
          y = -1;
        }
      }
      else if (keyCode === 39) {
        if (this.shiftKey) {
          x = 10;
        }
        else if (this.altKey) {
          x = 0.1;
        }
        else {
          x = 1;
        }
      }
      else if (keyCode === 40) {
        if (this.shiftKey) {
          y = 10;
        }
        else if (this.altKey) {
          y = 0.1;
        }
        else {
          y = 1;
        }
      }
      const nodes = this.selected.slice(0);
      const data: MoveData[] = [];
      nodes.forEach((node) => {
        const originStyle = node.getStyle();
        MoveCommand.operate(node, node.computedStyle, x, y);
        node.endPosChange(originStyle, x, y);
        data.push({ dx: x, dy: y });
      });
      if (nodes.length) {
        this.select.updateSelect(nodes);
        this.emit(interactionEvent.MOVE, nodes.slice(0));
        this.history.addCommand(new MoveCommand(nodes, data));
      }
    }
    // a全选
    else if ((keyCode === 65 || code === 'KeyA') && metaKey) {
      // 编辑文字状态特殊处理
      if (this.state === State.EDIT_TEXT && target === this.input.inputEl) {
        e.preventDefault();
        this.input.node!.selectAll();
        this.input.hideCursor();
      }
    }
    // z，undo/redo
    else if ((keyCode === 90 || code === 'KeyZ') && metaKey) {
      if (isInput && target !== this.input.inputEl) {
        return;
      }
      e.preventDefault();
      let c: AbstractCommand | undefined;
      if (this.shiftKey) {
        c = this.history.redo();
      }
      else {
        c = this.history.undo();
      }
      if (c) {
        const nodes = c.nodes.slice(0);
        const olds = this.selected.slice(0);
        let needUpdateSelectEvent = false;
        // 添加、删除等特殊命令需自行判断更新当前选择节点，其它的自动判断是否发生节点变更
        if (!(c instanceof RemoveCommand)) {
          this.selected.splice(0);
          this.selected.push(...nodes);
          this.updateActive();
          needUpdateSelectEvent = true;
        }
        if (c instanceof MoveCommand) {
          this.emit(interactionEvent.MOVE, nodes.slice(0));
        }
        else if (c instanceof ResizeCommand) {
          this.emit(interactionEvent.RESIZE, nodes.slice(0));
        }
        else if (c instanceof RemoveCommand) {
          if (this.shiftKey) {
            this.selected.splice(0);
            this.select.hideSelect();
            this.emit(interactionEvent.REMOVE, nodes.slice(0));
            this.emit(interactionEvent.SELECT, []);
          }
          else {
            this.selected.splice(0);
            this.selected.push(...nodes);
            this.updateActive();
            this.emit(interactionEvent.ADD, nodes.slice(0));
            this.emit(interactionEvent.SELECT, nodes.slice(0));
          }
        }
        else if (c instanceof RotateCommand) {
          this.emit(interactionEvent.ROTATE, nodes.slice(0));
        }
        else if (c instanceof TextCommand) {
          if (this.state === State.EDIT_TEXT) {
            const node = nodes[0] as Text;
            const { isMulti, start } = node.getSortedCursor();
            if (!isMulti) {
              const p = node.updateCursorByIndex(start);
              this.input.updateCursor(p);
              this.input.showCursor();
            }
            else {
              this.input.hideCursor();
            }
            this.input.focus();
          }
          this.emit(CONTENT, nodes.slice(0));
        }
        // 自动判断的命令，undo后可能执行的节点和当前的不一样，需要重新触发事件
        if (needUpdateSelectEvent) {
          if (nodes.length !== olds.length) {
            this.emit(interactionEvent.SELECT, nodes.slice(0));
          }
          else {
            for (let i = 0, len = nodes.length; i < len; i++) {
              if (nodes[i] !== olds[i]) {
                this.emit(interactionEvent.SELECT, nodes.slice(0));
                break;
              }
            }
          }
        }
      }
    }
  }

  onKeyUp(e: KeyboardEvent) {
    this.metaKey = e.metaKey;
    this.altKey = e.altKey;
    this.ctrlKey = e.ctrlKey;
    this.shiftKey = e.shiftKey;
    const metaKey = (this.metaKey || isWin && this.ctrlKey);
    // 实时切换rotate状态
    if (!this.options?.disabled?.rotate && !metaKey && !this.isRotate) {
      this.select.metaKey(false);
    }
  }

  removeNode(nodes = this.selected) {
    if (nodes.length) {
      const sel = nodes.splice(0).filter(item => !item.isLocked);
      const data: RemoveData[] = [];
      nodes.forEach((item, i) => {
        const o = RemoveCommand.operate(item);
        data.push(o);
      });
      this.select.hideSelect();
      this.history.addCommand(new RemoveCommand(sel, data));
      this.emit(interactionEvent.REMOVE, sel.slice(0));
      this.emit(interactionEvent.SELECT, []);
    }
  }

  active(nodes: AbstractNode[]) {
    const selected = this.selected;
    let diff = false;
    if (nodes.length !== selected.length) {
      diff = true;
    }
    else {
      for (let i = 0, len = nodes.length; i < len; i++) {
        if (nodes[i] !== selected[i]) {
          diff = true;
          break;
        }
      }
    }
    if (!diff) {
      return;
    }
    selected.splice(0);
    selected.push(...nodes);
    this.updateActive(true);
  }

  updateActive(emitEvent = false) {
    this.prepare();
    const selected = this.selected;
    if (selected.length) {
      this.select.showSelect(selected);
    }
    else {
      this.select.hideSelect();
    }
    if (emitEvent) {
      this.emit(interactionEvent.SELECT, selected.slice(0));
    }
  }

  beforeResize() {
    // 多个节点拉伸时，保持宽高比需记录初始信息
    if (this.selected.length > 1 && this.shiftKey) {
      this.selectRect = this.select.getAspectRatio();
      this.clientRect = this.selected.map(item => {
        const r = item.getBoundingClientRect();
        return {
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
        };
      });
    }
    else {
      this.selectRect = undefined;
      this.clientRect = undefined;
    }
  }

  cancelEditText(node?: AbstractNode) {
    if (this.state === State.EDIT_TEXT) {
      const text = (node || this.selected[0]) as Text;
      if (text) {
        text.resetCursor();
        text.afterEdit();
        text.inputStyle = undefined;
      }
      this.input.hide();
      this.state = State.NORMAL;
      this.select.select.classList.remove('text');
      this.emit(STATE_CHANGE, State.EDIT_TEXT, this.state);
    }
  }

  release() {
    this.eventListenerList.splice(0).forEach(item => {
      if (item.type === 'keydown' || item.type === 'keyup') {
        document.removeEventListener(item.type, item.cb);
      }
      else {
        this.dom.removeEventListener(item.type, item.cb);
      }
    });
    this.select.release();
    this.input.release();
  }
}

export default Listener;
