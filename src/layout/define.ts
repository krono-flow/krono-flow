export enum DISPLAY {
  NONE = 0,
  BLOCK = 1,
  INLINE = 2,
  INLINE_BLOCK = 3,
  FLEX = 4,
  GRID = 5,
}

export enum POSITION {
  STATIC = 0,
  RELATIVE = 1,
  ABSOLUTE = 2,
}

export type LayoutData = {
  x: number,
  y: number,
  w: number,
  h: number,
};
