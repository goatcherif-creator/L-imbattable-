import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BOSSES,
  ENEMY_ARCHETYPES,
  INITIAL_SKILL_LEVELS,
  SKILLS,
  WORLDS,
  getWorldById,
} from './data';
import {
  BossId,
  DamagePopup,
  EngineActions,
  GameHudSnapshot,
  KillBannerState,
  MinimapBlip,
  SkillId,
  SkillLevels,
  WorldDefinition,
  WorldId,
} from './types';
import {
  EnemyRig,
  FirstPersonRig,
  KnightRig,
  WorldEnvironmentResult,
  buildWorldEnvironment,
  createBossModel,
  createEnemyModel,
  createFirstPersonRig,
  createKnightModel,
} from './models';
import { createContactShadowTexture } from './textures';
import { soundEngine } from './audio';

const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

interface ActiveEnemy {
  uid: string;
  isBoss: boolean;
  bossId?: BossId;
  name: string;
  title?: string;
  role: 'skirmisher' | 'bruiser' | 'shielded' | 'ranged' | 'boss';
  rig: EnemyRig;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  windupTime: number;
  xpReward: number;
  scale: number;
  yaw: number;
  aiState: 'chase' | 'windup' | 'recover' | 'stunned';
  stateTimer: number;
  cooldownTimer: number;
  specialTimer: number;
  attackKind: 'melee' | 'ranged' | 'slam' | 'nova';
  hitFlashTimer: number;
  knockbackVel: THREE.Vector3;
  enraged: boolean;
  castingLabel?: string;
  strafeSign: number;
}

interface ActiveProjectile {
  mesh: THREE.Mesh;
  fromPlayer: boolean;
  vel: THREE.Vector3;
  damage: number;
  radius: number;
  life: number;
  piercing: boolean;
  hitUids: Set<string>;
}

interface GroundHazard {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  radius: number;
  timer: number;
  maxTimer: number;
  damage: number;
}

interface ExpandingVfx {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  riseSpeed: number;
}

interface PickupOrb {
  uid: string;
  kind: 'hp' | 'mana';
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  life: number;
}

export class KnightCombatEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;
  private shadowTex: THREE.CanvasTexture;

  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  private knight: KnightRig;
  private fpRig: FirstPersonRig;
  private worldEnv: WorldEnvironmentResult | null = null;
  private currentWorld: WorldDefinition = WORLDS[0];

  // Loop & timing
  private frameId = 0;
  private lastTime = performance.now();
  private elapsed = 0;
  private disposed = false;

  // Player kinematics & camera
  private playerPos = new THREE.Vector3(0, 0, 14);
  private playerVelY = 0;
  private isGrounded = true;
  private canDoubleJump = true;
  private isGliding = false;
  private isZiplining = false;
  private activeZiplineId: string | null = null;

  private playerYaw = 0; // 0 faces -Z
  private cameraYaw = 0;
  private cameraPitch = 0.08;
  private preferredCameraMode: 'first' | 'third' = 'first';
  private cameraShake = 0;
  private currentFov = 86;

  // Stats
  private hp = 180;
  private maxHp = 180;
  private mana = 100;
  private maxMana = 100;
  private stamina = 100;
  private maxStamina = 100;
  private level = 1;
  private xp = 0;
  private xpToNext = 100;
  private skillPoints = 1;
  private skillLevels: SkillLevels = { ...INITIAL_SKILL_LEVELS };
  private kills = 0;

  // Combat & Parkour state
  private attackTimer = 0;
  private attackDuration = 0.34;
  private comboStep = 0;
  private comboResetTimer = 0;
  private swingHitUids = new Set<string>();
  private snipeCooldown = 0;

  private slideTimer = 0;
  private slideCooldown = 0;
  private slideDir = new THREE.Vector3();
  private invulnTimer = 0;

  private isAiming = false;
  private blockStartTime = -10;
  private parryFlashTimer = 0;

  private bastionTimer = 0;
  private bastionBurnTick = 0;
  private skillCooldowns = {
    seismic_wave: 0,
    sacred_crescent: 0,
    ardent_bastion: 0,
  };

  // Input state
  private keys = new Set<string>();
  private dpadVec = new THREE.Vector2(0, 0);
  private dragLooking = false;
  private dragMovedDist = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Entities
  private enemies: ActiveEnemy[] = [];
  private projectiles: ActiveProjectile[] = [];
  private hazards: GroundHazard[] = [];
  private vfxList: ExpandingVfx[] = [];
  private orbs: PickupOrb[] = [];

  // Progression
  private waveIndex = 0;
  private waveTransitionTimer = 0;
  private phase: GameHudSnapshot['phase'] = 'playing';
  private unlockedWorlds: WorldId[] = ['moonlit_courtyard'];
  private defeatedBosses: BossId[] = [];
  private bannerText: string | null = null;
  private bannerSubtext: string | null = null;
  private bannerTimer = 0;
  private killBanner: KillBannerState | null = null;
  private killBannerTimer = 0;

  private onHudUpdate: (snap: GameHudSnapshot) => void;
  private onDamagePopup: (popup: DamagePopup) => void;
  private hudEmitAccum = 0;
  private nextUid = 1;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snap: GameHudSnapshot) => void,
    onDamagePopup: (popup: DamagePopup) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onDamagePopup = onDamagePopup;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );

    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      86,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.1,
      240,
    );
    this.scene.add(this.camera);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x78553a, 1.1);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff3d6, 2.35);
    this.keyLight.position.set(22, 34, 18);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 90;
    const d = 38;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rimLight.position.set(-18, 16, -22);
    this.scene.add(rimLight);

    this.shadowTex = createContactShadowTexture();
    this.knight = createKnightModel(this.shadowTex);
    this.scene.add(this.knight.root);

    this.fpRig = createFirstPersonRig();
    this.camera.add(this.fpRig.root);

    this.loadWorld('moonlit_courtyard', true);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindInputEvents();
    this.emitHudSnapshot();
    this.scheduleNextFrame();
  }

  public getActions(): EngineActions {
    return {
      setMoveVector: (x, y) => {
        this.dpadVec.set(x, y);
      },
      triggerAttack: () => this.performAttack(),
      setAiming: (active) => this.setAimingState(active),
      triggerJump: () => this.performJumpOrGlide(),
      triggerSlide: () => this.performSlide(),
      triggerZipline: () => this.tryGrabOrReleaseZipline(),
      toggleCameraMode: () => {
        this.preferredCameraMode = this.preferredCameraMode === 'first' ? 'third' : 'first';
        this.emitHudSnapshot();
      },
      triggerSkill: (skillId) => this.performActiveSkill(skillId),
      upgradeSkill: (skillId) => this.upgradeSkill(skillId),
      selectWorld: (worldId) => {
        if (this.unlockedWorlds.includes(worldId)) {
          this.loadWorld(worldId, false);
        }
      },
      restartWorld: () => this.loadWorld(this.currentWorld.id, false),
      advanceNextWorld: () => {
        const idx = WORLDS.findIndex((w) => w.id === this.currentWorld.id);
        const next = WORLDS[idx + 1];
        if (next) {
          if (!this.unlockedWorlds.includes(next.id)) {
            this.unlockedWorlds.push(next.id);
          }
          this.loadWorld(next.id, false);
        }
      },
      setPaused: (paused) => {
        if (
          this.phase === 'defeat' ||
          this.phase === 'victory_all' ||
          this.phase === 'world_cleared'
        ) {
          return;
        }
        this.phase = paused ? 'paused' : 'playing';
        if (paused && document.pointerLockElement === this.renderer.domElement) {
          document.exitPointerLock?.();
        }
        this.emitHudSnapshot();
      },
      lookDelta: (deltaYaw, deltaPitch) => {
        this.cameraYaw += deltaYaw;
        this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + deltaPitch, -0.85, 0.95);
      },
    };
  }

  private bindInputEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    dom.addEventListener('contextmenu', this.handleContextMenu);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private handleContextRestored = (): void => {
    this.renderer.compile(this.scene, this.camera);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;

    const dom = this.renderer.domElement;
    if (document.pointerLockElement !== dom) {
      try {
        const res = dom.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch {
        // Fallback drag-look works automatically
      }
    }

    if (e.button === 0) {
      this.dragLooking = true;
      this.dragMovedDist = 0;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      if (document.pointerLockElement === dom) {
        this.performAttack();
      }
    } else if (e.button === 2) {
      this.setAimingState(true);
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    const dom = this.renderer.domElement;
    const sens = this.isAiming ? 0.0018 : 0.0032;

    if (document.pointerLockElement === dom) {
      this.cameraYaw -= e.movementX * sens;
      this.cameraPitch = THREE.MathUtils.clamp(
        this.cameraPitch - e.movementY * sens,
        -0.85,
        0.95,
      );
      return;
    }

    if (this.dragLooking) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.dragMovedDist += Math.hypot(dx, dy);
      this.cameraYaw -= dx * sens * 1.4;
      this.cameraPitch = THREE.MathUtils.clamp(
        this.cameraPitch - dy * sens * 1.4,
        -0.85,
        0.95,
      );
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      if (this.dragLooking && document.pointerLockElement !== this.renderer.domElement) {
        if (this.dragMovedDist < 6 && this.phase === 'playing') {
          this.performAttack();
        }
      }
      this.dragLooking = false;
    } else if (e.button === 2) {
      this.setAimingState(false);
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    this.keys.add(code);

    if (this.phase !== 'playing') return;

    if (code === 'Space') {
      e.preventDefault();
      this.performJumpOrGlide();
    } else if (code === 'KeyJ') {
      this.performAttack();
    } else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyC') {
      this.performSlide();
    } else if (code === 'KeyF') {
      this.tryGrabOrReleaseZipline();
    } else if (code === 'KeyV') {
      this.preferredCameraMode = this.preferredCameraMode === 'first' ? 'third' : 'first';
      this.emitHudSnapshot();
    } else if (code === 'KeyL') {
      this.setAimingState(true);
    } else if (code === 'Digit1' || code === 'KeyE') {
      this.performActiveSkill('seismic_wave');
    } else if (code === 'Digit2' || code === 'KeyR') {
      this.performActiveSkill('sacred_crescent');
    } else if (code === 'Digit3' || code === 'KeyT') {
      this.performActiveSkill('ardent_bastion');
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.code === 'KeyL') {
      this.setAimingState(false);
    }
  };

  private getEffectiveCameraMode(): 'first' | 'third' {
    if (this.isZiplining || this.isGliding) return 'third';
    return this.preferredCameraMode;
  }

  private groundHeightAt(x: number, z: number): number {
    if (!this.worldEnv) return 0;
    let maxH = 0;

    for (const p of this.worldEnv.platforms) {
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
        if (p.topY > maxH && this.playerPos.y >= p.topY - 0.85) {
          maxH = p.topY;
        }
      }
    }

    for (const r of this.worldEnv.ramps) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        const t =
          r.axis === 'x'
            ? (x - r.minX) / Math.max(0.01, r.maxX - r.minX)
            : (z - r.minZ) / Math.max(0.01, r.maxZ - r.minZ);
        const h = r.highAtMax
          ? THREE.MathUtils.lerp(r.lowY, r.highY, t)
          : THREE.MathUtils.lerp(r.highY, r.lowY, t);
        if (h > maxH) maxH = h;
      }
    }
    return maxH;
  }

  private loadWorld(worldId: WorldId, isInitial: boolean): void {
    this.clearEntities();
    if (this.worldEnv) {
      this.scene.remove(this.worldEnv.group);
      this.worldEnv.disposables.forEach((d) => d.dispose());
      this.worldEnv = null;
    }

    this.currentWorld = getWorldById(worldId);
    this.scene.background = new THREE.Color(this.currentWorld.skyColor);
    this.scene.fog = new THREE.FogExp2(this.currentWorld.fogColor, this.currentWorld.fogDensity);

    this.keyLight.color.setHex(this.currentWorld.keyLightColor);
    this.keyLight.intensity = this.currentWorld.keyLightIntensity;
    this.hemiLight.color.setHex(this.currentWorld.hemiSkyColor);
    this.hemiLight.groundColor.setHex(this.currentWorld.hemiGroundColor);
    this.hemiLight.intensity = this.currentWorld.hemiIntensity;

    this.worldEnv = buildWorldEnvironment(this.currentWorld, this.maxAnisotropy);
    this.scene.add(this.worldEnv.group);

    this.playerPos.set(0, 0, 14);
    this.playerVelY = 0;
    this.isGrounded = true;
    this.isGliding = false;
    this.isZiplining = false;
    this.activeZiplineId = null;
    this.playerYaw = 0;
    this.cameraYaw = 0;
    this.cameraPitch = 0.08;

    this.hp = this.maxHp;
    this.mana = this.maxMana;
    this.stamina = this.maxStamina;
    this.bastionTimer = 0;
    this.attackTimer = 0;
    this.slideTimer = 0;
    this.isAiming = false;

    this.waveIndex = 0;
    this.phase = 'playing';
    this.spawnWave(0);

    if (!isInitial) {
      soundEngine.playLevelUp();
    }
    this.emitHudSnapshot();
  }

  private clearEntities(): void {
    this.enemies.forEach((e) => this.scene.remove(e.rig.root));
    this.enemies = [];
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.projectiles = [];
    this.hazards.forEach((h) => this.scene.remove(h.mesh));
    this.hazards = [];
    this.vfxList.forEach((v) => this.scene.remove(v.mesh));
    this.vfxList = [];
    this.orbs.forEach((o) => this.scene.remove(o.mesh));
    this.orbs = [];
  }

  private spawnWave(waveIdx: number): void {
    const wave = this.currentWorld.waves[waveIdx];
    if (!wave) return;

    this.waveIndex = waveIdx;
    const radius = Math.min(20, this.currentWorld.arenaRadius - 6);

    let spawnCount = 0;
    wave.enemies.forEach((group) => {
      const arch = ENEMY_ARCHETYPES[group.archetype];
      for (let i = 0; i < group.count; i++) {
        const angle =
          -Math.PI * 0.85 +
          ((spawnCount + 0.5) / 8) * Math.PI * 0.7 +
          (Math.random() - 0.5) * 0.4;
        const dist = radius * (0.65 + Math.random() * 0.3);
        const rig = createEnemyModel(arch, this.shadowTex);
        const x = Math.sin(angle) * dist;
        const z = -Math.abs(Math.cos(angle)) * dist - 2;
        rig.root.position.set(x, 0, z);
        this.scene.add(rig.root);

        this.enemies.push({
          uid: `e_${this.nextUid++}`,
          isBoss: false,
          name: arch.name,
          role: arch.role,
          rig,
          hp: arch.maxHp,
          maxHp: arch.maxHp,
          damage: arch.damage,
          speed: arch.speed,
          attackRange: arch.attackRange,
          attackCooldown: arch.attackCooldown,
          windupTime: arch.windupTime,
          xpReward: arch.xpReward,
          scale: arch.scale,
          yaw: 0,
          aiState: 'chase',
          stateTimer: 0,
          cooldownTimer: 0.5 + Math.random() * 0.8,
          specialTimer: 3,
          attackKind: arch.role === 'ranged' ? 'ranged' : 'melee',
          hitFlashTimer: 0,
          knockbackVel: new THREE.Vector3(),
          enraged: false,
          strafeSign: Math.random() > 0.5 ? 1 : -1,
        });
        spawnCount++;
      }
    });

    if (wave.boss) {
      const bossDef = BOSSES[wave.boss];
      const rig = createBossModel(bossDef, this.shadowTex);
      rig.root.position.set(0, 0, -16);
      this.scene.add(rig.root);

      this.enemies.push({
        uid: `boss_${this.nextUid++}`,
        isBoss: true,
        bossId: bossDef.id,
        name: bossDef.name,
        title: bossDef.title,
        role: 'boss',
        rig,
        hp: bossDef.maxHp,
        maxHp: bossDef.maxHp,
        damage: bossDef.damage,
        speed: bossDef.speed,
        attackRange: bossDef.attackRange,
        attackCooldown: bossDef.attackCooldown,
        windupTime: bossDef.windupTime,
        xpReward: bossDef.xpReward,
        scale: bossDef.scale,
        yaw: 0,
        aiState: 'chase',
        stateTimer: 0,
        cooldownTimer: 1.2,
        specialTimer: 4.5,
        attackKind: 'melee',
        hitFlashTimer: 0,
        knockbackVel: new THREE.Vector3(),
        enraged: false,
        strafeSign: 1,
      });

      this.showBanner(
        `${bossDef.name} — ${bossDef.title}`,
        `${this.currentWorld.name} · Combat de Boss`,
      );
      soundEngine.playBossSpawn();
    } else {
      this.showBanner(
        `Vague ${waveIdx + 1} / ${this.currentWorld.waves.length}`,
        this.currentWorld.name,
      );
    }
  }

  private showBanner(title: string, subtitle: string, duration = 2.4): void {
    this.bannerText = title;
    this.bannerSubtext = subtitle;
    this.bannerTimer = duration;
  }

  private triggerKillBanner(
    title: string,
    subtitle: string,
    tone: KillBannerState['tone'],
  ): void {
    this.killBanner = {
      id: this.nextUid++,
      title,
      subtitle,
      tone,
    };
    this.killBannerTimer = 1.65;
  }

  private setAimingState(active: boolean): void {
    if (active && !this.isAiming) {
      this.blockStartTime = this.elapsed;
    }
    this.isAiming = active;
  }

  private findNearbyZipline(): string | null {
    if (!this.worldEnv) return null;
    for (const z of this.worldEnv.ziplines) {
      const d = Math.hypot(this.playerPos.x - z.x, this.playerPos.z - z.z);
      if (d <= 2.9 && this.playerPos.y <= z.topY - 1.2) {
        return z.id;
      }
    }
    return null;
  }

  private tryGrabOrReleaseZipline(): void {
    if (this.phase !== 'playing') return;
    if (this.isZiplining) {
      this.isZiplining = false;
      this.activeZiplineId = null;
      this.playerVelY = 5.5;
      this.isGliding = true;
      return;
    }
    const zipId = this.findNearbyZipline();
    if (zipId && this.worldEnv) {
      const z = this.worldEnv.ziplines.find((item) => item.id === zipId);
      if (z) {
        this.isZiplining = true;
        this.activeZiplineId = zipId;
        this.isGliding = false;
        this.slideTimer = 0;
        this.playerPos.x = z.x;
        this.playerPos.z = z.z;
        soundEngine.playDodge();
      }
    }
  }

  private performJumpOrGlide(): void {
    if (this.phase !== 'playing') return;

    if (this.isZiplining) {
      this.tryGrabOrReleaseZipline();
      return;
    }

    if (this.isGrounded) {
      this.playerVelY = 10.2;
      this.isGrounded = false;
      this.canDoubleJump = true;
      this.isGliding = false;
      soundEngine.playDodge();
      this.spawnRingVfx(this.playerPos, 0x2dd4bf, 0.3, 1.5, 0.25);
    } else if (this.isGliding) {
      this.isGliding = false;
    } else if (this.canDoubleJump) {
      this.canDoubleJump = false;
      this.playerVelY = 8.4;
      this.isGliding = true;
      soundEngine.playSkill('crescent');
    } else {
      this.isGliding = true;
    }
  }

  private performSlide(): void {
    if (this.phase !== 'playing') return;
    if (this.slideTimer > 0 || this.slideCooldown > 0) return;
    if (this.stamina < 16) return;

    this.stamina -= 16;
    this.isZiplining = false;
    this.activeZiplineId = null;
    this.slideTimer = 0.42;
    this.slideCooldown = 0.65;
    this.invulnTimer = 0.34;

    const moveDir = this.getMoveDirectionWorld();
    if (moveDir.lengthSq() > 0.01) {
      this.slideDir.copy(moveDir).normalize();
    } else {
      this.slideDir.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    }

    soundEngine.playDodge();
    this.spawnRingVfx(this.playerPos, 0x22d3ee, 0.4, 2.0, 0.28);
  }

  private performAttack(): void {
    if (this.phase !== 'playing') return;

    // If holding Runic Aim, fire a high-velocity precision Netherflame snipe shot!
    if (this.isAiming) {
      if (this.snipeCooldown > 0) return;
      this.snipeCooldown = 0.45;
      this.performPrecisionShot();
      return;
    }

    if (this.attackTimer > 0.08) return;
    if (this.stamina < 6) return;

    const bladeLv = this.skillLevels.blade_mastery;
    const speedFactor = bladeLv >= 3 ? 0.82 : 1.0;

    this.stamina = Math.max(0, this.stamina - 8);
    this.comboStep = this.comboResetTimer > 0 ? (this.comboStep % 3) + 1 : 1;
    this.comboResetTimer = 1.05;
    this.attackDuration = (this.comboStep === 3 ? 0.4 : 0.3) * speedFactor;
    this.attackTimer = this.attackDuration;
    this.swingHitUids.clear();

    // Forward dash impulse on sword strike
    const fwdX = -Math.sin(this.cameraYaw);
    const fwdZ = -Math.cos(this.cameraYaw);
    this.playerYaw = this.cameraYaw;
    this.playerPos.x += fwdX * 0.55;
    this.playerPos.z += fwdZ * 0.55;
    this.clampToArena(this.playerPos, 1.0);

    // If diving from air/glide, trigger an aerial plunge shockwave!
    if (!this.isGrounded && this.playerPos.y > 1.8) {
      this.isGliding = false;
      this.playerVelY = -16;
    }

    soundEngine.playSwing(this.comboStep);
    this.spawnSlashArcVfx(
      this.comboStep === 3 ? 0x2dd4bf : 0x67e8f9,
      this.comboStep === 3 ? 3.1 : 2.3,
    );

    if (this.comboStep === 3 && bladeLv >= 2) {
      const waveDmg = (32 + (bladeLv - 1) * 12) * 1.2;
      this.spawnBladeProjectile(this.cameraYaw, waveDmg, 0x2dd4bf, bladeLv >= 4 ? 1.55 : 1.15);
    }
  }

  private performPrecisionShot(): void {
    const bladeLv = this.skillLevels.blade_mastery;
    const aegisLv = this.skillLevels.iron_aegis;
    const baseDmg = [34, 44, 56, 70, 88][bladeLv - 1];
    const hsMult = aegisLv >= 3 ? 2.3 : 2.0;

    soundEngine.playSkill('crescent');
    this.cameraShake = 0.14;

    // Raycast from camera center crosshair against enemies
    _rayOrigin.copy(this.camera.position);
    this.camera.getWorldDirection(_rayDir);

    let bestEnemy: ActiveEnemy | null = null;
    let bestDist = 70;
    let isHeadshot = false;

    for (const e of this.enemies) {
      const ePos = e.rig.root.position;
      const bodyCenter = _vecA.set(ePos.x, ePos.y + 1.05 * e.scale, ePos.z);
      const toCenter = _vecB.subVectors(bodyCenter, _rayOrigin);
      const proj = toCenter.dot(_rayDir);
      if (proj < 0.5 || proj > bestDist) continue;

      const closestPoint = _vecC.copy(_rayOrigin).addScaledVector(_rayDir, proj);
      const perpDist = closestPoint.distanceTo(bodyCenter);

      // Check head hit sphere separately
      const headCenter = _vecA.set(ePos.x, ePos.y + 1.62 * e.scale, ePos.z);
      const headDist = closestPoint.distanceTo(headCenter);

      if (headDist <= 0.55 * e.scale) {
        bestDist = proj;
        bestEnemy = e;
        isHeadshot = true;
      } else if (perpDist <= 0.88 * e.scale) {
        bestDist = proj;
        bestEnemy = e;
        isHeadshot = false;
      }
    }

    // Visual cyan tracer beam
    const endPoint = _vecA.copy(_rayOrigin).addScaledVector(_rayDir, bestEnemy ? bestDist : 40);
    const beamLen = _rayOrigin.distanceTo(endPoint);
    const beamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, beamLen, 6),
      new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.9 }),
    );
    beamMesh.position.copy(_rayOrigin).add(endPoint).multiplyScalar(0.5);
    beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _rayDir.clone().normalize());
    beamMesh.position.y -= 0.12;
    this.scene.add(beamMesh);
    this.vfxList.push({
      mesh: beamMesh,
      life: 0.18,
      maxLife: 0.18,
      startScale: 1,
      endScale: 1,
      riseSpeed: 0,
    });

    if (bestEnemy) {
      const finalDmg = baseDmg * (isHeadshot ? hsMult : 1.15);
      this.damageEnemy(
        bestEnemy,
        finalDmg,
        isHeadshot ? 'headshot' : 'crit',
        true,
        isHeadshot,
      );
      if (isHeadshot) {
        soundEngine.playBlock(true);
        this.triggerKillBanner(
          'HEADSHOT',
          `${bestEnemy.name} · +${Math.round(finalDmg)}`,
          'headshot',
        );
      }
    }
  }

  private performActiveSkill(skillId: 'seismic_wave' | 'sacred_crescent' | 'ardent_bastion'): void {
    if (this.phase !== 'playing') return;
    const lv = this.skillLevels[skillId];
    const def = SKILLS[skillId];

    if (this.skillCooldowns[skillId] > 0) return;
    const manaCost =
      skillId === 'seismic_wave' && lv >= 3
        ? Math.max(14, def.baseManaCost - 4)
        : def.baseManaCost;
    if (this.mana < manaCost) {
      this.spawnPopup(this.playerPos, 'Mana insuffisant', 'normal');
      return;
    }

    this.mana -= manaCost;
    let cd = def.baseCooldown;
    if (skillId === 'sacred_crescent' && lv >= 5) cd = 3.0;
    if (skillId === 'ardent_bastion' && lv >= 4) cd = 9.5;
    this.skillCooldowns[skillId] = cd;

    if (skillId === 'seismic_wave') {
      const dmg = [64, 84, 108, 136, 175][lv - 1];
      const radius = [4.6, 5.2, 6.0, 6.5, 7.2][lv - 1];
      const stunDur = lv >= 4 ? 1.4 : lv >= 2 ? 1.0 : 0.4;

      soundEngine.playSkill('seismic');
      this.cameraShake = 0.45;
      this.spawnRingVfx(this.playerPos, 0xf59e0b, 0.6, radius, 0.45);
      if (lv >= 4) {
        this.spawnRingVfx(this.playerPos, 0x2dd4bf, 0.3, radius * 0.8, 0.35);
      }

      for (const e of this.enemies) {
        const dist = e.rig.root.position.distanceTo(this.playerPos);
        if (dist <= radius + e.scale * 0.5) {
          this.damageEnemy(e, dmg, 'skill', true, lv >= 5);
          const push = _vecA.subVectors(e.rig.root.position, this.playerPos).setY(0);
          if (push.lengthSq() > 0.001) push.normalize();
          e.knockbackVel.addScaledVector(push, 9.0);
          if (!e.isBoss || stunDur > 0.8) {
            e.aiState = 'stunned';
            e.stateTimer = e.isBoss ? stunDur * 0.55 : stunDur;
          }
        }
      }
    } else if (skillId === 'sacred_crescent') {
      const dmg = [68, 90, 115, 132, 165][lv - 1];
      soundEngine.playSkill('crescent');
      this.spawnBladeProjectile(this.cameraYaw, dmg, 0x22d3ee, lv >= 5 ? 1.65 : 1.3);
      if (lv >= 4) {
        this.spawnBladeProjectile(this.cameraYaw - 0.22, dmg * 0.8, 0x67e8f9, 1.2);
        this.spawnBladeProjectile(this.cameraYaw + 0.22, dmg * 0.8, 0x67e8f9, 1.2);
      }
      this.attackTimer = 0.24;
      this.attackDuration = 0.24;
    } else if (skillId === 'ardent_bastion') {
      const healAmt = [50, 75, 100, 130, 175][lv - 1];
      const dur = [6, 6.5, 7, 8, 9][lv - 1];
      this.hp = Math.min(this.maxHp, this.hp + healAmt);
      if (lv >= 2) {
        this.stamina = Math.min(this.maxStamina, this.stamina + 30);
      }
      this.bastionTimer = dur;
      soundEngine.playSkill('bastion');
      this.spawnRingVfx(this.playerPos, 0xfb7185, 0.5, 3.4, 0.5);
      this.spawnPopup(this.playerPos, `+${healAmt} PV`, 'heal');
    }

    this.emitHudSnapshot();
  }

  private upgradeSkill(skillId: SkillId): void {
    const current = this.skillLevels[skillId];
    const def = SKILLS[skillId];
    if (this.skillPoints <= 0 || current >= def.maxLevel) return;

    this.skillPoints -= 1;
    this.skillLevels[skillId] = current + 1;
    soundEngine.playLevelUp();
    this.spawnRingVfx(this.playerPos, 0xfbbf24, 0.5, 2.8, 0.45);
    this.emitHudSnapshot();
  }

  private getMoveDirectionWorld(): THREE.Vector3 {
    let inputX = this.dpadVec.x;
    let inputY = this.dpadVec.y;

    if (this.keys.has('KeyW') || this.keys.has('KeyZ') || this.keys.has('ArrowUp')) inputY -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inputY += 1;
    if (this.keys.has('KeyA') || this.keys.has('KeyQ') || this.keys.has('ArrowLeft')) inputX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) inputX += 1;

    _vecA.set(inputX, 0, inputY);
    if (_vecA.lengthSq() > 1) _vecA.normalize();

    if (Math.abs(this.cameraYaw) > 0.001) {
      const cos = Math.cos(this.cameraYaw);
      const sin = Math.sin(this.cameraYaw);
      const rx = _vecA.x * cos + _vecA.z * sin;
      const rz = -_vecA.x * sin + _vecA.z * cos;
      _vecA.set(rx, 0, rz);
    }
    return _vecA;
  }

  private clampToArena(pos: THREE.Vector3, margin = 0.8): void {
    const limit = this.currentWorld.arenaRadius - margin;
    const lenSq = pos.x * pos.x + pos.z * pos.z;
    if (lenSq > limit * limit) {
      const len = Math.sqrt(lenSq);
      pos.x = (pos.x / len) * limit;
      pos.z = (pos.z / len) * limit;
    }
  }

  private spawnSlashArcVfx(colorHex: number, radius: number): void {
    const geo = new THREE.RingGeometry(
      radius * 0.55,
      radius,
      18,
      1,
      -Math.PI * 0.42,
      Math.PI * 0.84,
    );
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = this.playerYaw + Math.PI * 0.5;
    this.scene.add(mesh);
    this.vfxList.push({
      mesh,
      life: 0.2,
      maxLife: 0.2,
      startScale: 0.75,
      endScale: 1.32,
      riseSpeed: 0,
    });
  }

  private spawnRingVfx(
    center: THREE.Vector3,
    colorHex: number,
    startRadius: number,
    endRadius: number,
    duration: number,
  ): void {
    const geo = new THREE.RingGeometry(0.76, 1.0, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(center.x, center.y + 0.14, center.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(startRadius);
    this.scene.add(mesh);
    this.vfxList.push({
      mesh,
      life: duration,
      maxLife: duration,
      startScale: startRadius,
      endScale: endRadius,
      riseSpeed: 0.12,
    });
  }

  private spawnBladeProjectile(
    yaw: number,
    damage: number,
    colorHex: number,
    scale: number,
  ): void {
    const geo = new THREE.TorusGeometry(0.95 * scale, 0.12, 8, 18, Math.PI * 0.78);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      this.playerPos.x - Math.sin(yaw) * 1.1,
      this.playerPos.y + 1.2,
      this.playerPos.z - Math.cos(yaw) * 1.1,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.rotation.z = yaw - Math.PI * 0.89;
    this.scene.add(mesh);

    const speed = this.skillLevels.sacred_crescent >= 2 ? 28 : 22;
    this.projectiles.push({
      mesh,
      fromPlayer: true,
      vel: new THREE.Vector3(-Math.sin(yaw) * speed, 0, -Math.cos(yaw) * speed),
      damage,
      radius: 1.35 * scale,
      life: 1.2,
      piercing: true,
      hitUids: new Set(),
    });
  }

  private spawnEnemyProjectile(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    damage: number,
    colorHex: number,
    speed = 12.5,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshBasicMaterial({ color: colorHex }),
    );
    mesh.position.set(origin.x, origin.y + 1.2, origin.z);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      fromPlayer: false,
      vel: dir.clone().normalize().multiplyScalar(speed),
      damage,
      radius: 0.7,
      life: 2.6,
      piercing: false,
      hitUids: new Set(),
    });
  }

  private spawnGroundHazard(
    pos: THREE.Vector3,
    radius: number,
    delay: number,
    damage: number,
    colorHex: number,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 28),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.06, pos.z);
    this.scene.add(mesh);
    this.hazards.push({
      mesh,
      pos: pos.clone(),
      radius,
      timer: delay,
      maxTimer: delay,
      damage,
    });
  }

  private spawnPopup(
    worldPos: THREE.Vector3,
    text: string,
    tone: DamagePopup['tone'],
  ): void {
    _projVec.set(worldPos.x, worldPos.y + 2.0, worldPos.z).project(this.camera);
    if (_projVec.z > 1) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const sx = ((_projVec.x + 1) / 2) * w;
    const sy = (-(_projVec.y - 1) / 2) * h;

    this.onDamagePopup({
      id: this.nextUid++,
      screenX: sx + (Math.random() - 0.5) * 24,
      screenY: sy,
      text,
      tone,
    });
  }

  private damageEnemy(
    enemy: ActiveEnemy,
    rawDmg: number,
    tone: DamagePopup['tone'],
    ignoreShield = false,
    breakShield = false,
  ): void {
    if (enemy.role === 'shielded' && !ignoreShield && enemy.aiState !== 'stunned') {
      const toPlayer = _vecB
        .subVectors(this.playerPos, enemy.rig.root.position)
        .setY(0)
        .normalize();
      const enemyFwd = _vecC.set(-Math.sin(enemy.yaw), 0, -Math.cos(enemy.yaw));
      if (toPlayer.dot(enemyFwd) > 0.35) {
        soundEngine.playBlock(false);
        this.spawnPopup(enemy.rig.root.position, 'Bloqué', 'normal');
        enemy.hp -= Math.round(rawDmg * 0.25);
        return;
      }
    }

    if (breakShield && enemy.role === 'shielded') {
      enemy.aiState = 'stunned';
      enemy.stateTimer = 1.4;
    }

    const finalDmg = Math.max(1, Math.round(rawDmg));
    enemy.hp -= finalDmg;
    enemy.hitFlashTimer = 0.14;
    soundEngine.playHit(tone === 'crit' || tone === 'skill' || tone === 'headshot');
    this.spawnPopup(
      enemy.rig.root.position,
      tone === 'headshot' ? `HEADSHOT ${finalDmg}` : `${finalDmg}`,
      tone,
    );

    if (enemy.isBoss && !enemy.enraged && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.enraged = true;
      enemy.speed *= 1.22;
      enemy.attackCooldown *= 0.8;
      this.showBanner(`${enemy.name} Enragé !`, 'Phase II — Assauts accélérés', 2.1);
      this.spawnRingVfx(enemy.rig.root.position, 0xef4444, 0.8, 5.2, 0.55);
      soundEngine.playBossSpawn();
    }

    if (enemy.hp <= 0) {
      this.handleEnemyKilled(enemy);
    }
  }

  private handleEnemyKilled(enemy: ActiveEnemy): void {
    this.scene.remove(enemy.rig.root);
    this.enemies = this.enemies.filter((e) => e.uid !== enemy.uid);
    this.kills += 1;
    this.gainXp(enemy.xpReward);

    if (!enemy.isBoss) {
      this.triggerKillBanner(
        'ÉLIMINATION CONFIRMÉE',
        `${enemy.name} · +${enemy.xpReward} XP`,
        'kill',
      );
    }

    if (enemy.isBoss || Math.random() < 0.45) {
      const kind: 'hp' | 'mana' = this.hp < this.maxHp * 0.72 ? 'hp' : 'mana';
      const orbMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshBasicMaterial({ color: kind === 'hp' ? 0xef4444 : 0x22d3ee }),
      );
      orbMesh.position.set(enemy.rig.root.position.x, 0.55, enemy.rig.root.position.z);
      this.scene.add(orbMesh);
      this.orbs.push({
        uid: `orb_${this.nextUid++}`,
        kind,
        mesh: orbMesh,
        pos: orbMesh.position.clone(),
        life: 18,
      });
    }

    if (enemy.isBoss && enemy.bossId) {
      if (!this.defeatedBosses.includes(enemy.bossId)) {
        this.defeatedBosses.push(enemy.bossId);
      }
      const nextWorldIdx = WORLDS.findIndex((w) => w.id === this.currentWorld.id) + 1;
      if (nextWorldIdx < WORLDS.length) {
        const nextId = WORLDS[nextWorldIdx].id;
        if (!this.unlockedWorlds.includes(nextId)) {
          this.unlockedWorlds.push(nextId);
        }
        this.phase = 'world_cleared';
      } else {
        this.phase = 'victory_all';
      }
      soundEngine.playLevelUp();
      this.emitHudSnapshot();
      return;
    }

    if (this.enemies.length === 0 && this.phase === 'playing') {
      this.waveTransitionTimer = 1.2;
    }
  }

  private gainXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.skillPoints += 1;
      this.xpToNext = Math.round(this.xpToNext * 1.32);
      this.maxHp += 24;
      this.maxMana += 14;
      this.hp = this.maxHp;
      this.mana = this.maxMana;
      soundEngine.playLevelUp();
      this.spawnRingVfx(this.playerPos, 0xfbbf24, 0.5, 3.8, 0.55);
      this.spawnPopup(this.playerPos, `Niveau ${this.level} ! (+1 Faculté)`, 'heal');
    }
  }

  private applyPlayerDamage(rawDmg: number, attacker?: ActiveEnemy): void {
    if (this.invulnTimer > 0 || this.phase !== 'playing') return;

    if (this.isAiming) {
      const aegisLv = this.skillLevels.iron_aegis;
      const parryWindow = aegisLv >= 4 ? 0.34 : 0.25;
      const isParry = this.elapsed - this.blockStartTime <= parryWindow;

      if (isParry) {
        soundEngine.playBlock(true);
        this.parryFlashTimer = 0.45;
        this.invulnTimer = 0.3;
        this.cameraShake = 0.24;
        this.spawnRingVfx(this.playerPos, 0xfbbf24, 0.5, 3.0, 0.32);
        this.spawnPopup(this.playerPos, 'PARADE PARFAITE !', 'parry');

        if (aegisLv >= 2) {
          this.stamina = Math.min(this.maxStamina, this.stamina + 18);
          this.mana = Math.min(this.maxMana, this.mana + 10);
        }
        if (attacker) {
          attacker.aiState = 'stunned';
          attacker.stateTimer = attacker.isBoss ? 1.1 : 1.8;
          if (aegisLv >= 3) {
            this.damageEnemy(attacker, aegisLv >= 4 ? 60 : 40, 'parry', true, true);
          }
        }
        if (aegisLv >= 5) {
          for (const e of this.enemies) {
            if (e.rig.root.position.distanceTo(this.playerPos) <= 4.5) {
              this.damageEnemy(e, 48, 'parry', true, true);
            }
          }
        }
        return;
      }

      const blockReduction = [0.72, 0.8, 0.86, 0.92, 0.96][aegisLv - 1];
      const blockedDmg = Math.max(1, Math.round(rawDmg * (1 - blockReduction)));
      this.stamina = Math.max(0, this.stamina - 10);
      this.hp -= blockedDmg;
      soundEngine.playBlock(false);
      this.spawnPopup(this.playerPos, `-${blockedDmg} (Paré)`, 'normal');
      if (this.hp <= 0) {
        this.hp = 0;
        this.phase = 'defeat';
        this.emitHudSnapshot();
      }
      return;
    }

    let dmg = rawDmg;
    if (this.bastionTimer > 0 && this.skillLevels.ardent_bastion >= 3) {
      dmg *= 0.78;
    }

    const finalDmg = Math.max(1, Math.round(dmg));
    this.hp -= finalDmg;
    this.invulnTimer = 0.25;
    this.cameraShake = 0.3;
    soundEngine.playHit(true);
    this.spawnPopup(this.playerPos, `-${finalDmg}`, 'playerHit');

    if (this.hp <= 0) {
      this.hp = 0;
      this.phase = 'defeat';
      this.emitHudSnapshot();
    }
  }

  private tick(dt: number): void {
    this.elapsed += dt;

    if (this.worldEnv) {
      for (const fp of this.worldEnv.floatingProps) {
        fp.mesh.position.y = fp.baseY + Math.sin(this.elapsed * fp.speed + fp.phase) * 0.24;
        fp.mesh.rotation.y += dt * 0.8;
      }
    }

    if (this.phase !== 'playing') {
      this.updateCameraAndViewmodel(dt, 0);
      return;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
        this.bannerSubtext = null;
      }
    }

    if (this.killBannerTimer > 0) {
      this.killBannerTimer -= dt;
      if (this.killBannerTimer <= 0) {
        this.killBanner = null;
      }
    }

    if (this.waveTransitionTimer > 0) {
      this.waveTransitionTimer -= dt;
      if (this.waveTransitionTimer <= 0 && this.enemies.length === 0) {
        const nextWave = this.waveIndex + 1;
        if (nextWave < this.currentWorld.waves.length) {
          this.spawnWave(nextWave);
        }
      }
    }

    // Regen & cooldowns
    this.mana = Math.min(this.maxMana, this.mana + dt * 5.6);
    this.stamina = Math.min(this.maxStamina, this.stamina + dt * (this.isAiming ? 10 : 25));
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.parryFlashTimer = Math.max(0, this.parryFlashTimer - dt);
    this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    this.snipeCooldown = Math.max(0, this.snipeCooldown - dt);

    this.skillCooldowns.seismic_wave = Math.max(0, this.skillCooldowns.seismic_wave - dt);
    this.skillCooldowns.sacred_crescent = Math.max(0, this.skillCooldowns.sacred_crescent - dt);
    this.skillCooldowns.ardent_bastion = Math.max(0, this.skillCooldowns.ardent_bastion - dt);

    if (this.bastionTimer > 0) {
      this.bastionTimer = Math.max(0, this.bastionTimer - dt);
      (this.knight.auraRing.material as THREE.MeshBasicMaterial).opacity =
        0.55 + Math.sin(this.elapsed * 8) * 0.2;
      this.knight.auraRing.rotation.z += dt * 2.2;
      this.knight.swordGlowMat.emissive.setHex(0xf59e0b);
      this.knight.swordGlowMat.emissiveIntensity = 1.6;

      if (this.skillLevels.ardent_bastion >= 5) {
        this.bastionBurnTick -= dt;
        if (this.bastionBurnTick <= 0) {
          this.bastionBurnTick = 0.6;
          for (const e of this.enemies) {
            if (e.rig.root.position.distanceTo(this.playerPos) <= 3.8) {
              this.damageEnemy(e, 20, 'skill', true);
            }
          }
        }
      }
    } else {
      (this.knight.auraRing.material as THREE.MeshBasicMaterial).opacity = 0;
      this.knight.swordGlowMat.emissive.setHex(0x14b8a6);
      this.knight.swordGlowMat.emissiveIntensity = 1.1;
    }

    // Zipline, Slide, Parkour & Horizontal Movement
    let movingSpeed = 0;
    const speedBoost = this.bastionTimer > 0 ? 1.2 : 1.0;

    if (this.isZiplining && this.activeZiplineId && this.worldEnv) {
      const z = this.worldEnv.ziplines.find((item) => item.id === this.activeZiplineId);
      if (z) {
        this.playerPos.x = z.x;
        this.playerPos.z = z.z;
        this.playerPos.y += 14.5 * dt;
        movingSpeed = 14.5;
        if (this.playerPos.y >= z.topY) {
          this.playerPos.y = z.topY;
          this.isZiplining = false;
          this.activeZiplineId = null;
          this.playerVelY = 6.2;
          this.isGliding = true;
          this.canDoubleJump = false;
        }
      } else {
        this.isZiplining = false;
      }
    } else {
      if (this.slideTimer > 0) {
        this.slideTimer -= dt;
        const slideSpeed = 15.2 * speedBoost;
        this.playerPos.addScaledVector(this.slideDir, slideSpeed * dt);
        movingSpeed = slideSpeed;
      } else {
        const moveVec = this.getMoveDirectionWorld();
        const moveLen = moveVec.length();
        if (moveLen > 0.05) {
          const baseSpeed =
            (this.isGliding ? 12.8 : this.isAiming ? 5.6 : 9.8) * speedBoost;
          this.playerPos.addScaledVector(moveVec, baseSpeed * dt);
          movingSpeed = baseSpeed * moveLen;

          if (this.getEffectiveCameraMode() === 'third') {
            const targetYaw = Math.atan2(-moveVec.x, -moveVec.z);
            let diff = targetYaw - this.playerYaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.playerYaw += diff * Math.min(1, dt * 13);
          } else {
            this.playerYaw = this.cameraYaw;
          }
        } else if (this.getEffectiveCameraMode() === 'first') {
          this.playerYaw = this.cameraYaw;
        }
      }

      this.clampToArena(this.playerPos, 1.0);

      // Vertical gravity + platform/ramp collision
      const groundY = this.groundHeightAt(this.playerPos.x, this.playerPos.z);
      const wasAirborne = !this.isGrounded && this.playerPos.y > groundY + 1.4;
      const gravity = this.isGliding ? -6.5 : -24.0;
      this.playerVelY += gravity * dt;
      if (this.isGliding && this.playerVelY < -2.6) {
        this.playerVelY = -2.6;
      }
      this.playerPos.y += this.playerVelY * dt;

      if (this.playerPos.y <= groundY) {
        const impactVel = Math.abs(this.playerVelY);
        this.playerPos.y = groundY;
        this.playerVelY = 0;
        this.isGrounded = true;
        this.isGliding = false;
        this.canDoubleJump = true;

        // Aerial Plunge Slam if landing from a dive strike!
        if (wasAirborne && impactVel > 13) {
          this.cameraShake = 0.35;
          this.spawnRingVfx(this.playerPos, 0x2dd4bf, 0.5, 4.4, 0.38);
          soundEngine.playSkill('seismic');
          for (const e of [...this.enemies]) {
            if (e.rig.root.position.distanceTo(this.playerPos) <= 4.4) {
              this.damageEnemy(e, 48 + this.skillLevels.blade_mastery * 12, 'crit', true, true);
            }
          }
        }
      } else {
        this.isGrounded = false;
      }
    }

    this.knight.root.position.copy(this.playerPos);
    this.knight.root.rotation.y = this.playerYaw;
    this.knight.gliderWings.visible = this.isGliding;

    // Sword Attack Hit Detection
    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      const progress = 1 - this.attackTimer / this.attackDuration;
      if (progress >= 0.25 && progress <= 0.78) {
        const bladeLv = this.skillLevels.blade_mastery;
        const baseDmg = [32, 42, 54, 68, 85][bladeLv - 1];
        const comboMult = this.comboStep === 3 ? 1.35 : this.comboStep === 2 ? 1.15 : 1.0;
        const airMult = !this.isGrounded ? 1.25 : 1.0;
        const bastionMult =
          this.bastionTimer > 0
            ? 1 + [0.22, 0.3, 0.38, 0.45, 0.6][this.skillLevels.ardent_bastion - 1]
            : 1;
        const critChance = bladeLv >= 4 ? 0.28 : bladeLv >= 3 ? 0.2 : 0.1;
        const reach = bladeLv >= 4 ? 3.8 : 3.3;

        const fwdX = -Math.sin(this.cameraYaw);
        const fwdZ = -Math.cos(this.cameraYaw);

        for (const e of [...this.enemies]) {
          if (this.swingHitUids.has(e.uid)) continue;
          const toE = _vecB.subVectors(e.rig.root.position, this.playerPos);
          const vertDist = Math.abs(toE.y);
          toE.y = 0;
          const dist = toE.length();
          if (dist <= reach + e.scale * 0.6 && vertDist <= 3.0) {
            toE.normalize();
            const dot = toE.x * fwdX + toE.z * fwdZ;
            if (dot >= -0.2 || dist < 1.5) {
              this.swingHitUids.add(e.uid);
              const isCrit = Math.random() < critChance;
              const dmg = baseDmg * comboMult * airMult * bastionMult * (isCrit ? 1.6 : 1);
              this.damageEnemy(
                e,
                dmg,
                isCrit ? 'crit' : 'normal',
                this.comboStep === 3,
                this.comboStep === 3 && bladeLv >= 5,
              );
              e.knockbackVel.addScaledVector(toE, this.comboStep === 3 ? 6.5 : 3.8);
              if (this.comboStep === 3 && bladeLv >= 5 && !e.isBoss) {
                e.aiState = 'stunned';
                e.stateTimer = 0.75;
              }
            }
          }
        }
      }
    }

    this.animateKnight(dt, movingSpeed);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateVfxAndOrbs(dt);
    this.updateCameraAndViewmodel(dt, movingSpeed);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHudSnapshot(movingSpeed);
    }
  }

  private animateKnight(dt: number, movingSpeed: number): void {
    const walkPhase = this.elapsed * (movingSpeed > 1 ? 11.5 : 2.2);
    const walkAmp = movingSpeed > 1 && this.isGrounded ? 0.55 : 0.05;

    this.knight.leftLeg.rotation.x = Math.sin(walkPhase) * walkAmp;
    this.knight.rightLeg.rotation.x = -Math.sin(walkPhase) * walkAmp;

    const slideDrop = this.slideTimer > 0 ? -0.35 : 0;
    this.knight.body.position.y =
      0.92 + slideDrop + Math.abs(Math.cos(walkPhase)) * (movingSpeed > 1 ? 0.06 : 0.01);

    this.knight.capeSegments.forEach((seg, idx) => {
      const targetX =
        0.25 + (movingSpeed / 12) * 0.55 + Math.sin(this.elapsed * 6.0 + idx * 1.1) * 0.12;
      seg.rotation.x = THREE.MathUtils.damp(seg.rotation.x, targetX, 8, dt);
    });

    if (this.isZiplining) {
      this.knight.rightArm.rotation.x = -2.6;
      this.knight.leftArm.rotation.x = -2.4;
      return;
    }

    const targetLeftX = this.isAiming ? -1.0 : -0.25 - Math.sin(walkPhase) * walkAmp * 0.35;
    this.knight.leftArm.rotation.x = THREE.MathUtils.damp(
      this.knight.leftArm.rotation.x,
      targetLeftX,
      16,
      dt,
    );

    if (this.attackTimer > 0) {
      const p = 1 - this.attackTimer / this.attackDuration;
      if (this.comboStep === 1) {
        this.knight.rightArm.rotation.x = -1.6 + p * 2.2;
        this.knight.rightArm.rotation.y = -0.8 + p * 1.8;
      } else if (this.comboStep === 2) {
        this.knight.rightArm.rotation.x = -0.8;
        this.knight.rightArm.rotation.y = 1.1 - p * 2.3;
      } else {
        this.knight.rightArm.rotation.x = -2.1 + p * 2.7;
        this.knight.rightArm.rotation.y = 0;
      }
    } else if (this.slideTimer > 0) {
      this.knight.body.rotation.x = -0.35;
    } else {
      this.knight.body.rotation.x = THREE.MathUtils.damp(this.knight.body.rotation.x, 0, 12, dt);
      this.knight.rightArm.rotation.x = THREE.MathUtils.damp(
        this.knight.rightArm.rotation.x,
        -0.3 + Math.sin(walkPhase) * walkAmp * 0.35,
        12,
        dt,
      );
      this.knight.rightArm.rotation.y = THREE.MathUtils.damp(
        this.knight.rightArm.rotation.y,
        0,
        12,
        dt,
      );
    }
  }

  private updateEnemies(dt: number): void {
    for (const e of [...this.enemies]) {
      const pos = e.rig.root.position;

      if (e.knockbackVel.lengthSq() > 0.02) {
        pos.addScaledVector(e.knockbackVel, dt);
        e.knockbackVel.multiplyScalar(Math.exp(-9 * dt));
      }
      this.clampToArena(pos, 1.1);

      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        e.rig.accentMats.forEach((m) => {
          m.emissiveIntensity = e.hitFlashTimer > 0 ? 2.8 : e.isBoss ? 1.25 : 0.85;
        });
      }

      if (e.rig.wings) {
        e.rig.wings.forEach((w, idx) => {
          const side = idx % 2 === 0 ? -1 : 1;
          w.rotation.y = side * (0.25 + Math.sin(this.elapsed * 4.5 + idx) * 0.18);
        });
      }

      const toPlayer = _vecA.subVectors(this.playerPos, pos);
      const flatDist = Math.hypot(toPlayer.x, toPlayer.z);
      const targetYaw = flatDist > 0.01 ? Math.atan2(-toPlayer.x, -toPlayer.z) : e.yaw;

      e.cooldownTimer = Math.max(0, e.cooldownTimer - dt);
      e.specialTimer = Math.max(0, e.specialTimer - dt);

      const telegraphMat = e.rig.telegraphRing.material as THREE.MeshBasicMaterial;

      if (e.aiState === 'stunned') {
        e.stateTimer -= dt;
        telegraphMat.opacity = 0;
        e.rig.torso.rotation.x = -0.25;
        if (e.stateTimer <= 0) {
          e.aiState = 'chase';
          e.rig.torso.rotation.x = 0;
        }
        continue;
      }

      if (e.aiState === 'windup') {
        e.stateTimer -= dt;
        telegraphMat.opacity = 0.55 + Math.sin(this.elapsed * 26) * 0.25;
        e.rig.rightArm.rotation.x = THREE.MathUtils.damp(e.rig.rightArm.rotation.x, -2.0, 12, dt);

        if (e.stateTimer <= 0) {
          telegraphMat.opacity = 0;
          this.executeEnemyAttack(e, flatDist);
          e.aiState = 'recover';
          e.stateTimer = 0.42;
          e.cooldownTimer = e.attackCooldown;
        }
        continue;
      }

      if (e.aiState === 'recover') {
        e.stateTimer -= dt;
        e.rig.rightArm.rotation.x = THREE.MathUtils.damp(e.rig.rightArm.rotation.x, 0.2, 10, dt);
        if (e.stateTimer <= 0) {
          e.aiState = 'chase';
          e.castingLabel = undefined;
        }
        continue;
      }

      telegraphMat.opacity = 0;
      let diff = targetYaw - e.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      e.yaw += diff * Math.min(1, dt * 7);
      e.rig.root.rotation.y = e.yaw;

      if (e.isBoss && e.specialTimer <= 0 && flatDist < 16) {
        e.specialTimer = e.enraged ? 4.2 : 6.0;
        e.aiState = 'windup';
        e.stateTimer = e.windupTime * 1.15;
        e.attackKind = e.bossId === 'vespera' || e.bossId === 'malakor' ? 'nova' : 'slam';
        e.castingLabel = BOSSES[e.bossId!].signatureAbilityName;
        continue;
      }

      const desiredDist = e.role === 'ranged' ? 9.5 : e.attackRange * 0.85;
      if (flatDist > desiredDist) {
        const dir = _vecB.set(toPlayer.x, 0, toPlayer.z).normalize();
        const strafeX = -dir.z * e.strafeSign * 0.25;
        const strafeZ = dir.x * e.strafeSign * 0.25;
        pos.x += (dir.x + strafeX) * e.speed * dt;
        pos.z += (dir.z + strafeZ) * e.speed * dt;
        this.clampToArena(pos, 1.1);

        const walk = Math.sin(this.elapsed * 7.5) * 0.45;
        e.rig.leftLeg.rotation.x = walk;
        e.rig.rightLeg.rotation.x = -walk;
        e.rig.rightArm.rotation.x = THREE.MathUtils.damp(e.rig.rightArm.rotation.x, -0.35, 8, dt);
      } else if (e.cooldownTimer <= 0) {
        e.aiState = 'windup';
        e.stateTimer = e.windupTime;
        e.attackKind = e.role === 'ranged' ? 'ranged' : 'melee';
      }
    }
  }

  private executeEnemyAttack(e: ActiveEnemy, flatDist: number): void {
    const pos = e.rig.root.position;
    const toPlayer = _vecA.set(
      this.playerPos.x - pos.x,
      this.playerPos.y - pos.y,
      this.playerPos.z - pos.z,
    );

    if (e.attackKind === 'ranged') {
      const color = e.isBoss ? 0x2dd4bf : 0xa3e635;
      this.spawnEnemyProjectile(pos, toPlayer, e.damage, color, 13.5);
      return;
    }

    if (e.attackKind === 'slam') {
      this.cameraShake = 0.38;
      this.spawnRingVfx(pos, e.bossId === 'ignis_kael' ? 0xf97316 : 0xfbbf24, 0.8, 6.4, 0.5);
      if (flatDist <= 6.4 && this.playerPos.y < 2.2) {
        this.applyPlayerDamage(e.damage * 1.35, e);
      }
      if (e.bossId === 'ignis_kael') {
        for (let i = 0; i < 3; i++) {
          const offset = new THREE.Vector3(
            this.playerPos.x + (Math.random() - 0.5) * 7,
            0,
            this.playerPos.z + (Math.random() - 0.5) * 7,
          );
          this.clampToArena(offset, 2);
          this.spawnGroundHazard(offset, 2.4, 1.05, e.damage * 1.15, 0xf97316);
        }
      }
      return;
    }

    if (e.attackKind === 'nova') {
      const count = e.enraged ? 8 : 5;
      const color = e.bossId === 'malakor' ? 0xfde047 : 0x2dd4bf;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + this.elapsed;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        this.spawnEnemyProjectile(pos, dir, e.damage * 0.9, color, 11.5);
      }
      if (e.bossId === 'malakor') {
        this.spawnGroundHazard(
          new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z),
          2.6,
          0.95,
          e.damage * 1.2,
          0x818cf8,
        );
      }
      return;
    }

    e.rig.rightArm.rotation.x = 0.6;
    if (flatDist <= e.attackRange + 0.8 && Math.abs(this.playerPos.y - pos.y) <= 2.4) {
      this.applyPlayerDamage(e.damage, e);
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      let remove = p.life <= 0;

      if (p.fromPlayer) {
        for (const e of [...this.enemies]) {
          if (p.hitUids.has(e.uid)) continue;
          const d = e.rig.root.position.distanceTo(
            _vecA.set(p.mesh.position.x, e.rig.root.position.y, p.mesh.position.z),
          );
          if (d <= p.radius + e.scale * 0.7) {
            p.hitUids.add(e.uid);
            this.damageEnemy(e, p.damage, 'skill', true);
            if (e.isBoss && this.skillLevels.sacred_crescent >= 3) {
              this.damageEnemy(e, p.damage * 0.4, 'crit', true);
            }
            if (!p.piercing) {
              remove = true;
              break;
            }
          }
        }
      } else {
        const d = _vecA
          .set(this.playerPos.x, this.playerPos.y + 1.1, this.playerPos.z)
          .distanceTo(p.mesh.position);
        if (d <= p.radius + 0.55) {
          this.applyPlayerDamage(p.damage);
          remove = true;
        }
      }

      if (remove) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateHazards(dt: number): void {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.timer -= dt;
      const pct = 1 - h.timer / h.maxTimer;
      (h.mesh.material as THREE.MeshBasicMaterial).opacity = 0.25 + pct * 0.55;

      if (h.timer <= 0) {
        this.spawnRingVfx(h.pos, 0xfbbf24, 0.4, h.radius * 1.1, 0.35);
        if (
          Math.hypot(this.playerPos.x - h.pos.x, this.playerPos.z - h.pos.z) <= h.radius &&
          this.playerPos.y < 2.2
        ) {
          this.applyPlayerDamage(h.damage);
        }
        this.scene.remove(h.mesh);
        this.hazards.splice(i, 1);
      }
    }
  }

  private updateVfxAndOrbs(dt: number): void {
    for (let i = this.vfxList.length - 1; i >= 0; i--) {
      const v = this.vfxList[i];
      v.life -= dt;
      const t = 1 - Math.max(0, v.life) / v.maxLife;
      const s = THREE.MathUtils.lerp(v.startScale, v.endScale, t);
      v.mesh.scale.setScalar(s);
      v.mesh.position.y += v.riseSpeed * dt;
      (v.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      if (v.life <= 0) {
        this.scene.remove(v.mesh);
        this.vfxList.splice(i, 1);
      }
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= dt;
      o.mesh.rotation.y += dt * 2.5;
      o.mesh.position.y = 0.55 + Math.sin(this.elapsed * 4 + i) * 0.14;

      const dist = o.pos.distanceTo(this.playerPos);
      if (dist < 5.0) {
        const pull = _vecA.subVectors(this.playerPos, o.pos).setY(0).normalize();
        o.pos.addScaledVector(pull, 10.5 * dt);
        o.mesh.position.x = o.pos.x;
        o.mesh.position.z = o.pos.z;
      }

      if (dist < 1.5) {
        if (o.kind === 'hp') {
          this.hp = Math.min(this.maxHp, this.hp + 34);
          this.spawnPopup(this.playerPos, '+34 PV', 'heal');
        } else {
          this.mana = Math.min(this.maxMana, this.mana + 28);
          this.spawnPopup(this.playerPos, '+28 Mana', 'skill');
        }
        soundEngine.playSkill('bastion');
        this.scene.remove(o.mesh);
        this.orbs.splice(i, 1);
      } else if (o.life <= 0) {
        this.scene.remove(o.mesh);
        this.orbs.splice(i, 1);
      }
    }
  }

  private updateCameraAndViewmodel(dt: number, movingSpeed: number): void {
    const mode = this.getEffectiveCameraMode();
    const isFp = mode === 'first';
    this.knight.root.visible = !isFp;
    this.fpRig.root.visible = isFp && !this.isAiming;

    // Dynamic Bloodstrike-style FOV surge!
    let targetFov = 86;
    if (this.isAiming) targetFov = 46;
    else if (this.slideTimer > 0 || this.isZiplining) targetFov = 100;
    else if (this.isGliding || movingSpeed > 10.5) targetFov = 94;

    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 11, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    if (isFp) {
      const eyeHeight = this.slideTimer > 0 ? 1.05 : 1.68;
      this.camera.position.set(this.playerPos.x, this.playerPos.y + eyeHeight, this.playerPos.z);

      const lookDist = 10;
      const cosP = Math.cos(this.cameraPitch);
      const lookX = this.camera.position.x - Math.sin(this.cameraYaw) * cosP * lookDist;
      const lookY = this.camera.position.y + Math.sin(this.cameraPitch) * lookDist;
      const lookZ = this.camera.position.z - Math.cos(this.cameraYaw) * cosP * lookDist;
      this.camera.lookAt(lookX, lookY, lookZ);

      // Animate First-Person Netherflame Sword & Left Gauntlet
      const bob = movingSpeed > 1 && this.isGrounded ? Math.sin(this.elapsed * 13) * 0.035 : 0;
      if (this.attackTimer > 0) {
        const p = 1 - this.attackTimer / this.attackDuration;
        if (this.comboStep === 1) {
          this.fpRig.swordPivot.position.set(0.32 - p * 0.55, -0.3 + Math.sin(p * Math.PI) * 0.14, -0.58);
          this.fpRig.swordPivot.rotation.set(-0.6 - p * 1.1, 0.3 + p * 1.4, 0.25 + p * 1.1);
        } else if (this.comboStep === 2) {
          this.fpRig.swordPivot.position.set(-0.2 + p * 0.65, -0.28, -0.56);
          this.fpRig.swordPivot.rotation.set(-0.9, -1.0 + p * 2.0, -0.8 + p * 1.5);
        } else {
          this.fpRig.swordPivot.position.set(0.18, -0.15 - p * 0.35, -0.62);
          this.fpRig.swordPivot.rotation.set(-1.6 + p * 2.1, 0.1, 0.05);
        }
      } else {
        this.fpRig.swordPivot.position.x = THREE.MathUtils.damp(this.fpRig.swordPivot.position.x, 0.4 + bob * 0.5, 14, dt);
        this.fpRig.swordPivot.position.y = THREE.MathUtils.damp(this.fpRig.swordPivot.position.y, -0.34 + Math.abs(bob), 14, dt);
        this.fpRig.swordPivot.position.z = THREE.MathUtils.damp(this.fpRig.swordPivot.position.z, -0.58, 14, dt);
        this.fpRig.swordPivot.rotation.x = THREE.MathUtils.damp(this.fpRig.swordPivot.rotation.x, -0.55, 14, dt);
        this.fpRig.swordPivot.rotation.y = THREE.MathUtils.damp(this.fpRig.swordPivot.rotation.y, 0.24, 14, dt);
        this.fpRig.swordPivot.rotation.z = THREE.MathUtils.damp(
          this.fpRig.swordPivot.rotation.z,
          this.slideTimer > 0 ? 0.55 : 0.18,
          14,
          dt,
        );
      }
      this.fpRig.leftHand.position.y = THREE.MathUtils.damp(
        this.fpRig.leftHand.position.y,
        this.slideTimer > 0 ? -0.24 : -0.34 - bob * 0.5,
        12,
        dt,
      );
    } else {
      // Third-person aerial / zipline / parkour chase cam
      const distBack = this.isGliding ? 6.2 : 5.4;
      const height = this.isGliding ? 3.2 : 2.9;
      const camSin = Math.sin(this.cameraYaw);
      const camCos = Math.cos(this.cameraYaw);

      const desiredX = this.playerPos.x + camSin * distBack;
      const desiredZ = this.playerPos.z + camCos * distBack;
      const desiredY = this.playerPos.y + height - this.cameraPitch * 2.2;

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, desiredX, 11, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, desiredY, 11, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, desiredZ, 11, dt);

      const lookX = this.playerPos.x - camSin * 5.0;
      const lookZ = this.playerPos.z - camCos * 5.0;
      const lookY = this.playerPos.y + 1.55 + this.cameraPitch * 3.5;
      this.camera.lookAt(lookX, lookY, lookZ);
    }

    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.0);
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake * 0.35;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake * 0.25;
    }
  }

  private emitHudSnapshot(movingSpeed = 0): void {
    const boss = this.enemies.find((e) => e.isBoss);
    const blips: MinimapBlip[] = [
      ...this.enemies.map((e) => ({
        id: e.uid,
        x: e.rig.root.position.x,
        z: e.rig.root.position.z,
        kind: (e.isBoss ? 'boss' : 'enemy') as MinimapBlip['kind'],
      })),
      ...this.orbs.map((o) => ({
        id: o.uid,
        x: o.pos.x,
        z: o.pos.z,
        kind: 'orb' as const,
      })),
      ...(this.worldEnv?.ziplines.map((z) => ({
        id: z.id,
        x: z.x,
        z: z.z,
        kind: 'zipline' as const,
      })) ?? []),
    ];

    const headingDeg = (((-this.cameraYaw * 180) / Math.PI) % 360 + 360) % 360;
    const speedIntensity = Math.min(
      1,
      this.slideTimer > 0 || this.isZiplining
        ? 1
        : this.isGliding
          ? 0.72
          : Math.max(0, (movingSpeed - 7) / 6),
    );

    this.onHudUpdate({
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      mana: Math.round(this.mana),
      maxMana: this.maxMana,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      skillPoints: this.skillPoints,
      skillLevels: { ...this.skillLevels },
      kills: this.kills,
      comboStep: this.comboStep,
      isBlocking: this.isAiming,
      isAiming: this.isAiming,
      isSliding: this.slideTimer > 0,
      isGliding: this.isGliding,
      isZiplining: this.isZiplining,
      nearZipline: this.findNearbyZipline() !== null,
      cameraMode: this.getEffectiveCameraMode(),
      headingDeg,
      speedIntensity,
      parryFlash: this.parryFlashTimer > 0,
      bastionActiveTimer: this.bastionTimer,
      cooldowns: {
        ...this.skillCooldowns,
        dodge: this.slideCooldown,
      },
      maxCooldowns: {
        seismic_wave: SKILLS.seismic_wave.baseCooldown,
        sacred_crescent:
          this.skillLevels.sacred_crescent >= 5 ? 3.0 : SKILLS.sacred_crescent.baseCooldown,
        ardent_bastion:
          this.skillLevels.ardent_bastion >= 4 ? 9.5 : SKILLS.ardent_bastion.baseCooldown,
        dodge: 0.65,
      },
      worldId: this.currentWorld.id,
      worldName: this.currentWorld.name,
      waveIndex: this.waveIndex,
      totalWaves: this.currentWorld.waves.length,
      enemiesRemaining: this.enemies.length,
      activeBoss:
        boss && boss.bossId
          ? {
              id: boss.bossId,
              name: boss.name,
              title: boss.title ?? '',
              hp: Math.max(0, Math.round(boss.hp)),
              maxHp: boss.maxHp,
              enraged: boss.enraged,
              castingLabel: boss.castingLabel,
            }
          : null,
      playerPos: {
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        yaw: this.cameraYaw,
      },
      minimapBlips: blips,
      bannerText: this.bannerText,
      bannerSubtext: this.bannerSubtext,
      killBanner: this.killBanner,
      phase: this.phase,
      unlockedWorlds: [...this.unlockedWorlds],
      defeatedBosses: [...this.defeatedBosses],
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.loop);
    } else {
      this.frameId = requestAnimationFrame(this.loop);
    }
  }

  private loop = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.tick(dt);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.handleMouseDown);
    dom.removeEventListener('contextmenu', this.handleContextMenu);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.clearEntities();
    this.shadowTex.dispose();
    if (this.worldEnv) {
      this.worldEnv.disposables.forEach((d) => d.dispose());
    }
    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
