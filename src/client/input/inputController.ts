import type { Capability } from '../../engine/sim/definitions';
import type { CameraModel } from '../camera/cameraModel';
import type { CommandController } from '../commandController';
import { ACTION_INFO } from '../ui/commandPanel';

const DRAG_THRESHOLD = 5;
const EDGE_SIZE = 12;
const DOUBLE_CLICK_MS = 320;
const HOTKEYS = new Map<string, Capability>(
  (Object.entries(ACTION_INFO) as [Capability, { hotkey: string }][]).map(([action, info]) => [
    info.hotkey.toLowerCase(),
    action,
  ]),
);

export interface InputCallbacks {
  readonly onFirstGesture: () => void;
  readonly onToggleHelp: () => void;
  readonly onFocusSelection: () => void;
}

/** Mouse and keyboard handling for the battlefield: camera control, selection and orders. */
export class InputController {
  readonly pointer = { x: -1, y: -1, inside: false };
  private readonly held = new Set<string>();
  private drag: { x0: number; y0: number; active: boolean } | null = null;
  private rotateFrom: { x: number; y: number } | null = null;
  private lastClick = { time: 0, x: 0, y: 0 };
  private lastRecall = { digit: 0, time: 0 };

  constructor(
    private readonly surface: HTMLElement,
    private readonly dragBox: HTMLElement,
    private readonly camera: CameraModel,
    private readonly commands: CommandController,
    private readonly callbacks: InputCallbacks,
  ) {
    surface.addEventListener('mousedown', (e) => this.onMouseDown(e));
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    surface.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    document.addEventListener('mouseleave', () => (this.pointer.inside = false));
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.held.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.held.clear());
  }

  /** Continuous camera movement from held keys and screen-edge scrolling. */
  update(dt: number): void {
    const speed = this.camera.state.distance * 0.9 * dt;
    let right = 0;
    let forward = 0;
    if (this.held.has('arrowleft')) right -= 1;
    if (this.held.has('arrowright')) right += 1;
    if (this.held.has('arrowup')) forward += 1;
    if (this.held.has('arrowdown')) forward -= 1;
    if (this.pointer.inside && !this.drag?.active && !this.rotateFrom) {
      if (this.pointer.x <= EDGE_SIZE) right -= 1;
      if (this.pointer.x >= window.innerWidth - EDGE_SIZE) right += 1;
      if (this.pointer.y <= EDGE_SIZE) forward += 1;
      if (this.pointer.y >= window.innerHeight - EDGE_SIZE) forward -= 1;
    }
    if (right || forward) this.camera.pan(right * speed, forward * speed);
    if (this.held.has('q')) this.camera.rotate(-1.6 * dt);
    if (this.held.has('e')) this.camera.rotate(1.6 * dt);
    if (this.held.has('z')) this.camera.tilt(-0.9 * dt);
    if (this.held.has('c')) this.camera.tilt(0.9 * dt);
  }

  private onMouseDown(event: MouseEvent): void {
    this.callbacks.onFirstGesture();
    const { offsetX: x, offsetY: y } = event;
    if (event.button === 1) {
      event.preventDefault();
      this.rotateFrom = { x: event.clientX, y: event.clientY };
    } else if (event.button === 2) {
      if (this.commands.mode.kind !== 'select') this.commands.cancel();
      else this.commands.contextCommand(x, y);
    } else if (event.button === 0) {
      if (this.commands.mode.kind !== 'select') this.commands.targetClick(x, y);
      else this.drag = { x0: x, y0: y, active: false };
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.surface.getBoundingClientRect();
    this.pointer.x = event.clientX - rect.left;
    this.pointer.y = event.clientY - rect.top;
    this.pointer.inside = true;
    if (this.rotateFrom) {
      this.camera.rotate(-(event.clientX - this.rotateFrom.x) * 0.006);
      this.camera.tilt((event.clientY - this.rotateFrom.y) * 0.004);
      this.rotateFrom = { x: event.clientX, y: event.clientY };
    }
    const drag = this.drag;
    if (!drag) return;
    if (!drag.active && Math.hypot(this.pointer.x - drag.x0, this.pointer.y - drag.y0) > DRAG_THRESHOLD)
      drag.active = true;
    if (drag.active) this.showDragBox(drag.x0, drag.y0, this.pointer.x, this.pointer.y);
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 1) this.rotateFrom = null;
    if (event.button !== 0 || !this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.dragBox.hidden = true;
    if (drag.active) {
      this.commands.boxSelect({ x0: drag.x0, y0: drag.y0, x1: this.pointer.x, y1: this.pointer.y }, event.shiftKey);
      return;
    }
    const now = performance.now();
    const double =
      now - this.lastClick.time < DOUBLE_CLICK_MS &&
      Math.hypot(drag.x0 - this.lastClick.x, drag.y0 - this.lastClick.y) < 8;
    this.lastClick = { time: now, x: drag.x0, y: drag.y0 };
    this.commands.clickSelect(drag.x0, drag.y0, event.shiftKey, double);
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.camera.zoom(event.deltaY > 0 ? 1.12 : 1 / 1.12);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.held.add(key);
    if (event.key === 'F1') {
      event.preventDefault();
      this.callbacks.onToggleHelp();
    } else if (key === 'escape') {
      this.commands.cancel();
    } else if (key === ' ') {
      event.preventDefault();
      this.callbacks.onFocusSelection();
    } else if (/^[1-9]$/.test(key)) {
      this.onDigit(Number(key), event.ctrlKey || event.metaKey);
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    } else if (HOTKEYS.has(key) && !event.ctrlKey && !event.metaKey) {
      this.commands.beginAction(HOTKEYS.get(key)!);
    }
  }

  private onDigit(digit: number, assign: boolean): void {
    if (this.commands.buildMenuOpen && !assign) {
      const option = this.commands.buildOptions()[digit - 1];
      if (option) this.commands.beginPlacement(option.typeId);
      return;
    }
    if (assign) {
      this.commands.assignGroup(digit);
      return;
    }
    const now = performance.now();
    const doubleTap = this.lastRecall.digit === digit && now - this.lastRecall.time < DOUBLE_CLICK_MS + 100;
    this.lastRecall = { digit, time: now };
    if (this.commands.recallGroup(digit) && doubleTap) this.callbacks.onFocusSelection();
  }

  private showDragBox(x0: number, y0: number, x1: number, y1: number): void {
    Object.assign(this.dragBox.style, {
      left: `${Math.min(x0, x1)}px`,
      top: `${Math.min(y0, y1)}px`,
      width: `${Math.abs(x1 - x0)}px`,
      height: `${Math.abs(y1 - y0)}px`,
    });
    this.dragBox.hidden = false;
  }
}
