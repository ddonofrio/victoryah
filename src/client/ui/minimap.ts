import type { PlayerId, Point } from '../../engine/sim/types';
import type { World } from '../../engine/sim/world';
import { FogState } from '../../engine/world/visibility';
import type { Terrain } from '../../engine/world/terrain';
import { RESOURCE_COLORS, TILE_COLORS, teamColor } from '../render/palette';

export interface MinimapHandlers {
  readonly onNavigate: (x: number, y: number) => void;
  readonly onCommand: (x: number, y: number) => void;
}

const rgb = (color: number): [number, number, number] => [(color >> 16) & 255, (color >> 8) & 255, color & 255];
const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Overview of the planet: explored terrain (fogged), known deposits, own units, enemies currently
 * in sight, and the camera footprint. Redrawn at a low rate; terrain colours are cached.
 */
export class Minimap {
  private readonly context: CanvasRenderingContext2D;
  private readonly base: Uint8ClampedArray;
  private readonly image: ImageData;
  private readonly scale: number;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly terrain: Terrain,
    handlers: MinimapHandlers,
  ) {
    canvas.width = terrain.width;
    canvas.height = terrain.height;
    this.context = canvas.getContext('2d')!;
    this.scale = 1;
    this.image = this.context.createImageData(terrain.width, terrain.height);
    this.base = this.buildBase();
    this.bindPointer(handlers);
  }

  render(world: World, player: PlayerId, cameraFootprint: readonly Point[]): void {
    this.drawTerrain(world, player);
    const ctx = this.context;
    for (const deposit of world.knownDeposits(player)) {
      ctx.fillStyle = css(RESOURCE_COLORS[deposit.kind]);
      ctx.fillRect(deposit.x * this.scale - 1, deposit.y * this.scale - 1, 2, 2);
    }
    for (const entity of world.perceivedEntities(player)) {
      const size = world.def(entity.typeId).domain === 'structure' ? 4 : 3;
      ctx.fillStyle = css(teamColor(entity.owner));
      ctx.fillRect(entity.x * this.scale - size / 2, entity.y * this.scale - size / 2, size, size);
    }
    this.drawFootprint(cameraFootprint);
  }

  private buildBase(): Uint8ClampedArray {
    const data = new Uint8ClampedArray(this.terrain.width * this.terrain.height * 4);
    for (let y = 0; y < this.terrain.height; y++) {
      for (let x = 0; x < this.terrain.width; x++) {
        const [r, g, b] = rgb(TILE_COLORS[this.terrain.kindAt(x, y)]);
        data.set([r, g, b, 255], (y * this.terrain.width + x) * 4);
      }
    }
    return data;
  }

  private drawTerrain(world: World, player: PlayerId): void {
    const vision = world.visibility(player);
    const pixels = this.image.data;
    for (let y = 0; y < this.terrain.height; y++) {
      for (let x = 0; x < this.terrain.width; x++) {
        const i = (y * this.terrain.width + x) * 4;
        const state = vision.stateAt(x, y);
        const factor = state === FogState.Visible ? 1 : state === FogState.Explored ? 0.45 : 0;
        pixels[i] = this.base[i]! * factor;
        pixels[i + 1] = this.base[i + 1]! * factor;
        pixels[i + 2] = this.base[i + 2]! * factor;
        pixels[i + 3] = 255;
      }
    }
    this.context.putImageData(this.image, 0, 0);
  }

  private drawFootprint(points: readonly Point[]): void {
    if (points.length < 3) return;
    const ctx = this.context;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    points.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x * this.scale, p.y * this.scale) : ctx.lineTo(p.x * this.scale, p.y * this.scale),
    );
    ctx.closePath();
    ctx.stroke();
  }

  private bindPointer(handlers: MinimapHandlers): void {
    const toMap = (event: MouseEvent): Point => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * this.terrain.width,
        y: ((event.clientY - rect.top) / rect.height) * this.terrain.height,
      };
    };
    let dragging = false;
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('mousedown', (event) => {
      const p = toMap(event);
      if (event.button === 2) handlers.onCommand(p.x, p.y);
      if (event.button !== 0) return;
      dragging = true;
      handlers.onNavigate(p.x, p.y);
    });
    window.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      const p = toMap(event);
      handlers.onNavigate(p.x, p.y);
    });
    window.addEventListener('mouseup', () => (dragging = false));
  }
}
