export type SkillId =
  | 'blade_mastery'
  | 'iron_aegis'
  | 'seismic_wave'
  | 'sacred_crescent'
  | 'ardent_bastion';

export type WorldId =
  | 'moonlit_courtyard'
  | 'ashen_marsh'
  | 'obsidian_forge'
  | 'astral_throne';

export type EnemyArchetypeId =
  | 'goblin_scout'
  | 'orc_brute'
  | 'renegade_knight'
  | 'bog_wraith'
  | 'putrid_ghoul'
  | 'peat_golem'
  | 'ember_imp'
  | 'brazen_legionnaire'
  | 'basalt_colossus'
  | 'astral_sentinel'
  | 'void_crossbowman'
  | 'fallen_paladin';

export type BossId =
  | 'gorgath'
  | 'vespera'
  | 'ignis_kael'
  | 'malakor';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  subtitle: string;
  kind: 'passive' | 'active' | 'defense';
  hotkey?: string;
  maxLevel: number;
  baseManaCost: number;
  baseCooldown: number;
  accentHex: string;
  description: string;
  levelDetails: string[];
}

export type SkillLevels = Record<SkillId, number>;

export interface EnemyArchetype {
  id: EnemyArchetypeId;
  name: string;
  role: 'skirmisher' | 'bruiser' | 'shielded' | 'ranged';
  maxHp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  windupTime: number;
  xpReward: number;
  scale: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
}

export interface BossDefinition {
  id: BossId;
  name: string;
  title: string;
  maxHp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  windupTime: number;
  xpReward: number;
  scale: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  signatureAbilityName: string;
}

export interface WaveSpec {
  enemies: Array<{ archetype: EnemyArchetypeId; count: number }>;
  boss?: BossId;
}

export interface WorldDefinition {
  id: WorldId;
  order: number;
  name: string;
  subtitle: string;
  description: string;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  keyLightColor: number;
  keyLightIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  accentLightColor: number;
  floorTheme: 'cobble' | 'marsh' | 'lava' | 'astral';
  arenaRadius: number;
  waves: WaveSpec[];
  bossId: BossId;
}

export interface MinimapBlip {
  id: string;
  x: number;
  z: number;
  kind: 'enemy' | 'boss' | 'orb' | 'zipline';
}

export interface DamagePopup {
  id: number;
  screenX: number;
  screenY: number;
  text: string;
  tone: 'normal' | 'crit' | 'skill' | 'parry' | 'heal' | 'playerHit' | 'headshot';
}

export interface ActiveBossHud {
  id: BossId;
  name: string;
  title: string;
  hp: number;
  maxHp: number;
  enraged: boolean;
  castingLabel?: string;
}

export interface KillBannerState {
  id: number;
  title: string;
  subtitle: string;
  tone: 'headshot' | 'kill' | 'boss';
}

export interface GameHudSnapshot {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
  skillLevels: SkillLevels;
  kills: number;
  comboStep: number;
  isBlocking: boolean;
  isAiming: boolean;
  isSliding: boolean;
  isGliding: boolean;
  isZiplining: boolean;
  nearZipline: boolean;
  cameraMode: 'first' | 'third';
  headingDeg: number;
  speedIntensity: number;
  parryFlash: boolean;
  bastionActiveTimer: number;
  cooldowns: {
    seismic_wave: number;
    sacred_crescent: number;
    ardent_bastion: number;
    dodge: number;
  };
  maxCooldowns: {
    seismic_wave: number;
    sacred_crescent: number;
    ardent_bastion: number;
    dodge: number;
  };
  worldId: WorldId;
  worldName: string;
  waveIndex: number;
  totalWaves: number;
  enemiesRemaining: number;
  activeBoss: ActiveBossHud | null;
  playerPos: { x: number; y: number; z: number; yaw: number };
  minimapBlips: MinimapBlip[];
  bannerText: string | null;
  bannerSubtext: string | null;
  killBanner: KillBannerState | null;
  phase: 'playing' | 'paused' | 'world_cleared' | 'victory_all' | 'defeat';
  unlockedWorlds: WorldId[];
  defeatedBosses: BossId[];
}

export interface EngineActions {
  setMoveVector: (x: number, y: number) => void;
  triggerAttack: () => void;
  setAiming: (active: boolean) => void;
  triggerJump: () => void;
  triggerSlide: () => void;
  triggerZipline: () => void;
  toggleCameraMode: () => void;
  triggerSkill: (skillId: 'seismic_wave' | 'sacred_crescent' | 'ardent_bastion') => void;
  upgradeSkill: (skillId: SkillId) => void;
  selectWorld: (worldId: WorldId) => void;
  restartWorld: () => void;
  advanceNextWorld: () => void;
  setPaused: (paused: boolean) => void;
  lookDelta: (deltaYaw: number, deltaPitch: number) => void;
}
