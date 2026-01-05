import inject from '../util/inject';

let isPause: boolean;

export class Frame {
  task: ((delta: number) => void)[];
  now: number;
  id: number;

  constructor() {
    this.task = [];
    this.now = inject.now();
    this.id = 0;
  }

  private init() {
    const { task } = this;
    inject.cancelAnimationFrame(this.id);
    let last = this.now = inject.now();

    const cb = () => {
      // 必须清除，可能会发生重复，当动画finish回调中gotoAndPlay(0)，下方结束判断发现aTask还有值会继续，新的init也会进入再次执行
      inject.cancelAnimationFrame(this.id);
      this.id = inject.requestAnimationFrame(() => {
        const now = this.now = inject.now();
        if (isPause || !task.length) {
          return;
        }
        let delta = now - last;
        delta = Math.max(delta, 0);
        last = now;
        const clone = task.slice(0);
        clone.forEach(item => {
          item(delta);
        });
        // 还有则继续，没有则停止节省性能
        if (task.length) {
          cb();
        }
      });
    }

    cb();
  }

  onFrame(handle: (delta: number) => void) {
    const task = this.task;
    if (!task.length) {
      this.init();
    }
    task.push(handle);
  }

  offFrame(handle: (delta: number) => void) {
    const task = this.task;
    const i = task.indexOf(handle);
    if (i > -1) {
      task.splice(i, 1);
    }
    if (!task.length) {
      inject.cancelAnimationFrame(this.id);
      this.now = 0;
    }
  }

  nextFrame(handle: (delta: number) => void) {
    // 包裹一层下帧执行后自动取消
    const cb = (delta: number) => {
      handle(delta);
      this.offFrame(cb);
    };
    this.onFrame(cb);
    return cb;
  }

  pause() {
    isPause = true;
  }

  resume() {
    if (isPause) {
      this.init();
      isPause = false;
    }
  }
}

export const frame = new Frame();

export default frame;
