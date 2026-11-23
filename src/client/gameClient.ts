import type { GameSession } from '../app/gameSession';
import type { SaveStore } from '../app/saveStore';
import { SoundBoard } from './audio/soundBoard';
import { CameraModel } from './camera/cameraModel';
import { CommandController } from './commandController';
import { EventPresenter } from './eventPresenter';
import { InputController } from './input/inputController';
import { DepositView } from './render/depositView';
import { EffectsView } from './render/effectsView';
import { FogOfWarTexture } from './render/fogMaterial';
import { HeightField } from './render/heightField';
import { PlacementGhost } from './render/placementGhost';
import { createScene, type SceneBundle } from './render/sceneSetup';
import { TerrainView } from './render/terrainView';
import { UnitView } from './render/unitView';
import { WorldPicker } from './render/worldPicker';
import { CommandPanel } from './ui/commandPanel';
import { Minimap } from './ui/minimap';
import { SelectionPanel } from './ui/selectionPanel';
import { Toast } from './ui/toast';
import { TopBar } from './ui/topBar';

const HUD_INTERVAL = 0.1;
const MINIMAP_INTERVAL = 0.25;
const AUTOSAVE_INTERVAL = 15;
const BOTTOM_BAR_HEIGHT = 200;

interface Views {
  readonly heights: HeightField;
  readonly fog: FogOfWarTexture;
  readonly terrain: TerrainView;
  readonly units: UnitView;
  readonly deposits: DepositView;
  readonly effects: EffectsView;
  readonly ghost: PlacementGhost;
}

interface Hud {
  readonly top: TopBar;
  readonly selection: SelectionPanel;
  readonly commands: CommandPanel;
  readonly minimap: Minimap;
  readonly toast: Toast;
}

/**
 * Browser presentation of a GameSession: renders the perceived world, translates input into
 * commands and drives the session from the animation frame clock.
 */
export class GameClient {
  private readonly bundle: SceneBundle;
  private readonly camera: CameraModel;
  private readonly views: Views;
  private readonly hud: Hud;
  private readonly sound = new SoundBoard();
  private readonly picker: WorldPicker;
  private readonly controller: CommandController;
  private readonly input: InputController;
  private readonly presenter: EventPresenter;
  private readonly timers = { hud: 0, minimap: 0, save: 0 };
  private lastFrame = 0;
  private time = 0;

  constructor(
    private readonly doc: Document,
    private readonly session: GameSession,
    private readonly store: SaveStore,
    private readonly onNewPlanet: () => void,
  ) {
    const viewport = doc.getElementById('viewport')!;
    this.bundle = createScene(viewport);
    this.views = this.createViews();
    this.camera = this.createCamera();
    this.picker = new WorldPicker(this.bundle.camera, viewport, this.views.terrain, this.views.units);
    const toast = new Toast(doc.getElementById('toast')!);
    this.controller = new CommandController(session, this.picker, {
      effects: this.views.effects,
      sound: this.sound,
      toast,
    });
    this.hud = this.createHud(toast);
    this.input = new InputController(viewport, doc.getElementById('drag-box')!, this.camera, this.controller, {
      onFirstGesture: () => this.sound.unlock(),
      onToggleHelp: () => this.toggleHelp(),
      onFocusSelection: () => this.focusSelection(),
    });
    this.presenter = new EventPresenter(session.simulation.world, session.localPlayerId, this.views, this.sound, toast);
    this.bindLifecycle();
  }

  start(): void {
    this.views.units.sync();
    this.lastFrame = performance.now();
    requestAnimationFrame((now) => this.frame(now));
  }

  save(): void {
    this.store.save(this.session.toSavedGame());
  }

  private createViews(): Views {
    const { terrain, simulation, localPlayerId } = this.session;
    const heights = new HeightField(terrain);
    const fog = new FogOfWarTexture(terrain.width, terrain.height);
    const views: Views = {
      heights,
      fog,
      terrain: new TerrainView(terrain, heights, fog),
      units: new UnitView(simulation.world, localPlayerId, heights),
      deposits: new DepositView(simulation.world, localPlayerId, heights),
      effects: new EffectsView(heights),
      ghost: new PlacementGhost(heights),
    };
    this.bundle.scene.add(
      views.terrain.root,
      views.deposits.root,
      views.units.root,
      views.effects.root,
      views.ghost.mesh,
    );
    return views;
  }

  private createCamera(): CameraModel {
    const world = this.session.simulation.world;
    const home = world
      .entitiesList()
      .find((e) => e.owner === this.session.localPlayerId && e.typeId === 'commandCenter');
    const start = home ?? world.entitiesList().find((e) => e.owner === this.session.localPlayerId);
    return new CameraModel(this.session.terrain, {
      targetX: start?.x ?? world.width / 2,
      targetZ: (start?.y ?? world.height / 2) + 4,
      yaw: 0,
      pitch: 0.95,
      distance: 34,
    });
  }

  private createHud(toast: Toast): Hud {
    const top = new TopBar(this.doc, {
      onHelp: () => this.toggleHelp(),
      onSound: () => this.sound.toggle(),
      onNewPlanet: () => this.onNewPlanet(),
    });
    top.setPlanet(this.doc, this.session.seed);
    this.doc.getElementById('btn-help-close')!.addEventListener('click', () => this.toggleHelp());
    return {
      top,
      toast,
      selection: new SelectionPanel(this.doc.getElementById('selection-panel')!, (typeId) =>
        this.controller.selectType(typeId),
      ),
      commands: new CommandPanel(this.doc.getElementById('command-panel')!, {
        onAction: (action) => this.controller.beginAction(action),
        onBuild: (typeId) => this.controller.beginPlacement(typeId),
        onBack: () => this.controller.cancel(),
      }),
      minimap: new Minimap(this.doc.getElementById('minimap') as HTMLCanvasElement, this.session.terrain, {
        onNavigate: (x, y) => this.camera.focus(x, y),
        onCommand: (x, y) => this.controller.contextCommandAt({ x, y }),
      }),
    };
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;
    this.input.update(dt);
    if (this.session.advance(dt) > 0) this.views.units.sync();
    const target = { x: this.camera.state.targetX, y: this.camera.state.targetZ };
    this.presenter.present(this.session.simulation.drainEvents(), target, this.session.alpha, this.time);
    this.renderWorld(dt);
    this.tickTimers(dt);
    requestAnimationFrame((t) => this.frame(t));
  }

  private renderWorld(dt: number): void {
    const { camera, renderer, scene } = this.bundle;
    const eye = this.camera.eye();
    camera.position.set(eye.x, eye.y, eye.z);
    camera.lookAt(this.camera.state.targetX, 0, this.camera.state.targetZ);
    const views = this.views;
    views.terrain.update(this.camera.state.targetX, this.camera.state.targetZ, this.camera.state.distance * 2.2 + 30);
    views.fog.update(this.session.simulation.world.visibility(this.session.localPlayerId));
    views.units.render(this.session.alpha, this.controller.selection, camera, this.time);
    views.effects.update(dt);
    this.updateGhost();
    this.bundle.renderer.domElement.parentElement!.classList.toggle(
      'targeting',
      this.controller.mode.kind !== 'select',
    );
    renderer.render(scene, camera);
  }

  private updateGhost(): void {
    const mode = this.controller.mode;
    const pointer = this.input.pointer;
    const ground = mode.kind === 'place' && pointer.inside ? this.picker.ground(pointer.x, pointer.y, false) : null;
    if (!ground || mode.kind !== 'place') {
      this.views.ghost.hide();
      return;
    }
    const footprint = this.session.simulation.world.def(mode.structureType).footprint ?? 1;
    this.views.ghost.show(
      ground.x,
      ground.y,
      footprint,
      this.controller.isPlacementValid(ground.x, ground.y, mode.structureType),
    );
  }

  private tickTimers(dt: number): void {
    const world = this.session.simulation.world;
    const player = this.session.localPlayerId;
    this.timers.hud += dt;
    this.timers.minimap += dt;
    this.timers.save += dt;
    if (this.timers.hud >= HUD_INTERVAL) {
      this.timers.hud = 0;
      this.views.deposits.update(this.time);
      this.hud.top.update(world.player(player).stockpile);
      this.hud.selection.render(world, this.controller.selectedEntities(), player);
      this.hud.commands.render(this.controller.panelState());
    }
    if (this.timers.minimap >= MINIMAP_INTERVAL) {
      this.timers.minimap = 0;
      this.hud.minimap.render(world, player, this.picker.footprint(BOTTOM_BAR_HEIGHT));
    }
    if (this.timers.save >= AUTOSAVE_INTERVAL) {
      this.timers.save = 0;
      this.save();
    }
  }

  private focusSelection(): void {
    const selected = this.controller.selectedEntities();
    if (selected.length === 0) return;
    const x = selected.reduce((sum, e) => sum + e.x, 0) / selected.length;
    const y = selected.reduce((sum, e) => sum + e.y, 0) / selected.length;
    this.camera.focus(x, y);
  }

  private toggleHelp(): void {
    const help = this.doc.getElementById('help')!;
    help.hidden = !help.hidden;
  }

  private bindLifecycle(): void {
    window.addEventListener('beforeunload', () => this.save());
    this.doc.addEventListener('visibilitychange', () => {
      if (this.doc.visibilityState === 'hidden') this.save();
    });
  }
}
