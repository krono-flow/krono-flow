import { ComputedGradient, ComputedTextShadow, TEXT_DECORATION } from '../style/define';

class TextBox {
  x: number;
  y: number;
  w: number;
  lineHeight: number;
  baseline: number;
  contentArea: number;
  index: number; // 位于整个Text字符串的索引
  str: string;
  font: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  letterSpacing: number;
  textDecoration: TEXT_DECORATION[];
  textShadow?: ComputedTextShadow;
  stroke: (number[] | ComputedGradient)[];
  strokeWidth: number[];
  strokeEnable: boolean[];

  constructor(
    x: number,
    y: number,
    w: number,
    lineHeight: number,
    baseline: number,
    contentArea: number,
    index: number,
    str: string,
    font: string,
    fontFamily: string,
    fontSize: number,
    color: string,
    letterSpacing: number,
    textDecoration: TEXT_DECORATION[],
    textShadow: ComputedTextShadow | undefined,
    stroke: (number[] | ComputedGradient)[],
    strokeWidth: number[],
    strokeEnable: boolean[],
  ) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.lineHeight = lineHeight;
    this.baseline = baseline;
    this.contentArea = contentArea;
    this.index = index;
    this.str = str;
    this.font = font;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;
    this.color = color;
    this.letterSpacing = letterSpacing;
    this.textDecoration = textDecoration;
    this.textShadow = textShadow;
    this.stroke = stroke;
    this.strokeWidth = strokeWidth;
    this.strokeEnable = strokeEnable;
  }
}

export default TextBox;
