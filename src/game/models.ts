import * as THREE from 'three';
import { BossDefinition, EnemyArchetype, WorldDefinition } from './types';
import { createWorldFloorTextures } from './textures';

export interface KnightRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  capeSegments: THREE.Mesh[];
  shieldMesh: THREE.Group;
  swordGroup: THREE.Group;
  swordGlowMat: THREE.MeshStandardMaterial;
  auraRing: THREE.Mesh;
  gliderWings: THREE.Group;
}

export interface FirstPersonRig {
  root: THREE.Group;
  swordPivot: THREE.Group;
  leftHand: THREE.Group;
  bladeMat: THREE.MeshStandardMaterial;
  coreMat: THREE.MeshStandardMaterial;
}

export interface EnemyRig {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponGroup: THREE.Group;
  accentMats: THREE.MeshStandardMaterial[];
  wings?: THREE.Mesh[];
  telegraphRing: THREE.Mesh;
}

export interface PlatformBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
}

export interface RampSpec {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  axis: 'x' | 'z';
  lowY: number;
  highY: number;
  highAtMax: boolean;
}

export interface ZiplineAnchor {
  id: string;
  x: number;
  z: number;
  baseY: number;
  topY: number;
}

export interface WorldEnvironmentResult {
  group: THREE.Group;
  platforms: PlatformBox[];
  ramps: RampSpec[];
  ziplines: ZiplineAnchor[];
  flickerLights: Array<{ light: THREE.PointLight; baseIntensity: number; phase: number }>;
  floatingProps: Array<{ mesh: THREE.Object3D; baseY: number; speed: number; phase: number }>;
  disposables: Array<{ dispose: () => void }>;
}

function createShieldGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.56);
  shape.lineTo(0.34, 0.44);
  shape.lineTo(0.28, -0.1);
  shape.lineTo(0, -0.58);
  shape.lineTo(-0.28, -0.1);
  shape.lineTo(-0.34, 0.44);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function createLongswordBladeGeometry(length = 1.15): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.048, 0);
  shape.lineTo(0.048, 0);
  shape.lineTo(0.036, length * 0.82);
  shape.lineTo(0, length);
  shape.lineTo(-0.036, length * 0.82);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -0.01);
  return geo;
}

export function createFirstPersonRig(): FirstPersonRig {
  const root = new THREE.Group();

  const gauntletMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.78,
    roughness: 0.34,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xd4a44a,
    metalness: 0.9,
    roughness: 0.22,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf,
    metalness: 0.45,
    roughness: 0.16,
    emissive: 0x14b8a6,
    emissiveIntensity: 1.45,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x22d3ee,
    emissiveIntensity: 2.0,
    roughness: 0.15,
  });

  // Left armored hand (visible during slide/sprint/aim)
  const leftHand = new THREE.Group();
  leftHand.position.set(-0.42, -0.32, -0.52);
  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.38), gauntletMat);
  leftForearm.rotation.set(0.25, -0.35, 0.1);
  const leftKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.12), trimMat);
  leftKnuckle.position.set(0.05, 0.03, -0.18);
  leftHand.add(leftForearm, leftKnuckle);
  root.add(leftHand);

  // Right Netherflame Cyan Energy Greatsword Viewmodel
  const swordPivot = new THREE.Group();
  swordPivot.position.set(0.4, -0.34, -0.58);
  swordPivot.rotation.set(-0.55, 0.24, 0.18);
  root.add(swordPivot);

  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.065, 0.36, 8), gauntletMat);
  rightForearm.position.set(0.03, -0.18, 0.12);
  rightForearm.rotation.x = 0.75;
  swordPivot.add(rightForearm);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.22, 8), gauntletMat);
  grip.position.y = -0.05;
  swordPivot.add(grip);

  const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.06), trimMat);
  crossguard.position.y = 0.06;
  swordPivot.add(crossguard);

  const runeWheel = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 14), coreMat);
  runeWheel.position.set(0, 0.14, 0);
  swordPivot.add(runeWheel);

  const blade = new THREE.Mesh(createLongswordBladeGeometry(0.98), bladeMat);
  blade.position.y = 0.12;
  swordPivot.add(blade);

  return { root, swordPivot, leftHand, bladeMat, coreMat };
}

export function createKnightModel(shadowTex: THREE.CanvasTexture): KnightRig {
  const root = new THREE.Group();

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.75),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.58,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.88,
    roughness: 0.24,
  });
  const darkIronMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.82,
    roughness: 0.42,
  });
  const capeMat = new THREE.MeshStandardMaterial({
    color: 0x162238,
    metalness: 0.05,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x452718,
    metalness: 0.08,
    roughness: 0.78,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xd4a44a,
    metalness: 0.92,
    roughness: 0.22,
  });
  const swordGlowMat = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf,
    metalness: 0.55,
    roughness: 0.16,
    emissive: 0x14b8a6,
    emissiveIntensity: 1.1,
  });

  const body = new THREE.Group();
  body.position.y = 0.92;
  root.add(body);

  const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.23, 0.62, 10), steelMat);
  cuirass.position.y = 0.26;
  cuirass.castShadow = true;
  body.add(cuirass);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.11, 10), leatherMat);
  belt.position.y = -0.02;
  body.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.06), goldTrimMat);
  buckle.position.set(0, -0.02, -0.24);
  body.add(buckle);

  const gorget = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.12, 10), darkIronMat);
  gorget.position.y = 0.58;
  body.add(gorget);

  const head = new THREE.Group();
  head.position.set(0, 0.66, 0);
  body.add(head);

  const helmDome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), steelMat);
  helmDome.position.y = 0.12;
  helmDome.scale.set(0.95, 1.12, 1.05);
  helmDome.castShadow = true;
  head.add(helmDome);

  const helmCrest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.34), darkIronMat);
  helmCrest.position.set(0, 0.28, 0.02);
  head.add(helmCrest);

  const visorPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.17, 0.19, 8, 1, false, Math.PI * 0.65, Math.PI * 0.7),
    darkIronMat,
  );
  visorPlate.position.set(0, 0.09, -0.03);
  head.add(visorPlate);

  const visorSlit = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.032, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
  );
  visorSlit.position.set(0, 0.13, -0.19);
  head.add(visorSlit);

  const capeSegments: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const stripGeo = new THREE.PlaneGeometry(0.22 - i * 0.02, 0.96 - (i % 2) * 0.12, 1, 4);
    stripGeo.translate(0, -0.45, 0);
    const strip = new THREE.Mesh(stripGeo, capeMat);
    strip.position.set((i - 1) * 0.16, 0.52, 0.22);
    strip.rotation.x = 0.22;
    strip.rotation.z = (i - 1) * -0.08;
    strip.castShadow = true;
    body.add(strip);
    capeSegments.push(strip);
  }

  // Parachute / Energy Glider wings (visible when gliding!)
  const gliderWings = new THREE.Group();
  gliderWings.position.set(0, 1.05, 0.15);
  gliderWings.visible = false;
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.6,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const canopyTrimMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf });
  const wingCanopy = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.8, 10, 1, true, -Math.PI * 0.38, Math.PI * 0.76), canopyMat);
  wingCanopy.rotation.z = Math.PI / 2;
  wingCanopy.rotation.y = Math.PI / 2;
  const canopyArc = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.03, 6, 16, Math.PI * 0.76), canopyTrimMat);
  canopyArc.rotation.y = Math.PI / 2;
  gliderWings.add(wingCanopy, canopyArc);
  body.add(gliderWings);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.37, 0.48, 0);
  body.add(leftArm);

  const leftPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), steelMat);
  leftPauldron.scale.set(1.1, 0.85, 1.1);
  leftArm.add(leftPauldron);

  const leftVambrace = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.48, 8), darkIronMat);
  leftVambrace.position.set(0, -0.26, -0.05);
  leftVambrace.rotation.x = 0.35;
  leftArm.add(leftVambrace);

  const shieldGroup = new THREE.Group();
  shieldGroup.position.set(-0.14, -0.32, -0.18);
  shieldGroup.rotation.y = Math.PI * 0.42;
  leftArm.add(shieldGroup);

  const shieldBody = new THREE.Mesh(createShieldGeometry(), darkIronMat);
  shieldGroup.add(shieldBody);

  const shieldRim = new THREE.Mesh(createShieldGeometry(), steelMat);
  shieldRim.scale.set(1.06, 1.05, 0.72);
  shieldRim.position.z = -0.01;
  shieldGroup.add(shieldRim);

  const shieldCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), goldTrimMat);
  shieldCrest.position.set(0, 0.05, 0.045);
  shieldCrest.scale.set(0.9, 1.3, 0.4);
  shieldGroup.add(shieldCrest);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.37, 0.48, 0);
  body.add(rightArm);

  const rightPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), steelMat);
  rightPauldron.scale.set(1.1, 0.85, 1.1);
  rightArm.add(rightPauldron);

  const rightVambrace = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.48, 8), darkIronMat);
  rightVambrace.position.set(0, -0.26, -0.06);
  rightVambrace.rotation.x = 0.42;
  rightArm.add(rightVambrace);

  const swordGroup = new THREE.Group();
  swordGroup.position.set(0.02, -0.46, -0.22);
  swordGroup.rotation.x = -Math.PI * 0.38;
  rightArm.add(swordGroup);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.22, 8), leatherMat);
  grip.position.y = -0.08;
  swordGroup.add(grip);

  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), goldTrimMat);
  pommel.position.y = -0.21;
  swordGroup.add(pommel);

  const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.055), goldTrimMat);
  crossguard.position.y = 0.03;
  swordGroup.add(crossguard);

  const blade = new THREE.Mesh(createLongswordBladeGeometry(1.18), swordGlowMat);
  blade.position.y = 0.05;
  blade.castShadow = true;
  swordGroup.add(blade);

  const buildLeg = (xOffset: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(xOffset, 0.88, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.085, 0.42, 8), darkIronMat);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    leg.add(thigh);

    const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.072, 0.44, 8), steelMat);
    greave.position.y = -0.62;
    greave.castShadow = true;
    leg.add(greave);

    const sabaton = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.26), steelMat);
    sabaton.position.set(0, -0.83, -0.05);
    sabaton.castShadow = true;
    leg.add(sabaton);
    return leg;
  };

  const leftLeg = buildLeg(-0.14);
  const rightLeg = buildLeg(0.14);
  root.add(leftLeg, rightLeg);

  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1.05, 32),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.06;
  root.add(auraRing);

  return {
    root,
    body,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    capeSegments,
    shieldMesh: shieldGroup,
    swordGroup,
    swordGlowMat,
    auraRing,
    gliderWings,
  };
}

export function createEnemyModel(
  arch: EnemyArchetype,
  shadowTex: THREE.CanvasTexture,
): EnemyRig {
  const root = new THREE.Group();

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65 * arch.scale, 1.65 * arch.scale),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95 * arch.scale, 1.25 * arch.scale, 28),
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.04;
  root.add(telegraphRing);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: arch.primaryColor,
    roughness: arch.role === 'shielded' ? 0.35 : 0.68,
    metalness: arch.role === 'shielded' ? 0.75 : 0.22,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: arch.secondaryColor,
    roughness: 0.5,
    metalness: 0.45,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: arch.accentColor,
    roughness: 0.25,
    metalness: 0.35,
    emissive: arch.accentColor,
    emissiveIntensity: 0.85,
  });

  const actorGroup = new THREE.Group();
  actorGroup.scale.setScalar(arch.scale);
  root.add(actorGroup);

  const torso = new THREE.Group();
  torso.position.y = 0.92;
  actorGroup.add(torso);

  const chest = new THREE.Mesh(
    arch.role === 'bruiser'
      ? new THREE.DodecahedronGeometry(0.38, 0)
      : new THREE.CylinderGeometry(0.28, 0.21, 0.64, 8),
    primaryMat,
  );
  chest.position.y = 0.28;
  chest.castShadow = true;
  torso.add(chest);

  const armorBelt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 8), secondaryMat);
  armorBelt.position.y = -0.02;
  torso.add(armorBelt);

  const head = new THREE.Group();
  head.position.set(0, 0.66, 0);
  torso.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), primaryMat);
  skull.position.y = 0.12;
  skull.castShadow = true;
  head.add(skull);

  const eyeGeo = new THREE.SphereGeometry(0.038, 6, 6);
  const eyeL = new THREE.Mesh(eyeGeo, accentMat);
  eyeL.position.set(-0.075, 0.14, -0.17);
  const eyeR = new THREE.Mesh(eyeGeo, accentMat);
  eyeR.position.set(0.075, 0.14, -0.17);
  head.add(eyeL, eyeR);

  if (arch.role === 'bruiser') {
    const hornGeo = new THREE.ConeGeometry(0.05, 0.22, 6);
    const hornL = new THREE.Mesh(hornGeo, secondaryMat);
    hornL.position.set(-0.16, 0.26, -0.04);
    hornL.rotation.z = 0.55;
    const hornR = new THREE.Mesh(hornGeo, secondaryMat);
    hornR.position.set(0.16, 0.26, -0.04);
    hornR.rotation.z = -0.55;
    head.add(hornL, hornR);
  } else if (arch.role === 'skirmisher') {
    const earGeo = new THREE.ConeGeometry(0.04, 0.2, 5);
    const earL = new THREE.Mesh(earGeo, primaryMat);
    earL.position.set(-0.22, 0.16, 0);
    earL.rotation.z = Math.PI * 0.42;
    const earR = new THREE.Mesh(earGeo, primaryMat);
    earR.position.set(0.22, 0.16, 0);
    earR.rotation.z = -Math.PI * 0.42;
    head.add(earL, earR);
  } else if (arch.role === 'ranged') {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.34, 7), secondaryMat);
    hood.position.set(0, 0.22, 0.04);
    hood.rotation.x = 0.22;
    head.add(hood);
  } else {
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.22, 8), secondaryMat);
    helm.position.y = 0.15;
    head.add(helm);
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.36, 0.48, 0);
  torso.add(leftArm);
  const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 7), primaryMat);
  armLMesh.position.y = -0.22;
  leftArm.add(armLMesh);

  if (arch.role === 'shielded') {
    const towerShield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.46), secondaryMat);
    towerShield.position.set(-0.1, -0.26, -0.18);
    towerShield.rotation.y = Math.PI * 0.38;
    leftArm.add(towerShield);
  }

  const rightArm = new THREE.Group();
  rightArm.position.set(0.36, 0.48, 0);
  torso.add(rightArm);
  const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 7), primaryMat);
  armRMesh.position.y = -0.22;
  rightArm.add(armRMesh);

  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0, -0.44, -0.15);
  weaponGroup.rotation.x = -Math.PI * 0.35;
  rightArm.add(weaponGroup);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), secondaryMat);
  shaft.position.y = 0.35;
  weaponGroup.add(shaft);

  if (arch.role === 'bruiser') {
    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.34), accentMat);
    axeHead.position.set(0, 0.72, -0.12);
    weaponGroup.add(axeHead);
  } else if (arch.role === 'ranged') {
    const orbTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), accentMat);
    orbTip.position.y = 0.85;
    weaponGroup.add(orbTip);
  } else {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.72, 0.1), secondaryMat);
    blade.position.y = 0.65;
    weaponGroup.add(blade);
  }

  const makeLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.88, 0);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.82, 7), secondaryMat);
    mesh.position.y = -0.41;
    mesh.castShadow = true;
    leg.add(mesh);
    return leg;
  };
  const leftLeg = makeLeg(-0.15);
  const rightLeg = makeLeg(0.15);
  actorGroup.add(leftLeg, rightLeg);

  return {
    root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponGroup,
    accentMats: [accentMat],
    telegraphRing,
  };
}

export function createBossModel(
  boss: BossDefinition,
  shadowTex: THREE.CanvasTexture,
): EnemyRig {
  const root = new THREE.Group();

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6 * boss.scale, 2.6 * boss.scale),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  root.add(shadowPlane);

  const telegraphRing = new THREE.Mesh(
    new THREE.RingGeometry(1.6 * boss.scale, 2.15 * boss.scale, 36),
    new THREE.MeshBasicMaterial({
      color: boss.accentColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  telegraphRing.rotation.x = -Math.PI / 2;
  telegraphRing.position.y = 0.05;
  root.add(telegraphRing);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: boss.primaryColor,
    roughness: 0.35,
    metalness: 0.72,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: boss.secondaryColor,
    roughness: 0.48,
    metalness: 0.55,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: boss.accentColor,
    roughness: 0.2,
    metalness: 0.4,
    emissive: boss.accentColor,
    emissiveIntensity: 1.25,
  });

  const actorGroup = new THREE.Group();
  actorGroup.scale.setScalar(boss.scale);
  root.add(actorGroup);

  const torso = new THREE.Group();
  torso.position.y = 1.0;
  actorGroup.add(torso);

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.28, 0.78, 10), primaryMat);
  chest.position.y = 0.36;
  chest.castShadow = true;
  torso.add(chest);

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), accentMat);
  core.position.set(0, 0.42, -0.34);
  torso.add(core);

  const pauldronGeo = new THREE.DodecahedronGeometry(0.24, 0);
  const pL = new THREE.Mesh(pauldronGeo, secondaryMat);
  pL.position.set(-0.48, 0.62, 0);
  const pR = new THREE.Mesh(pauldronGeo, secondaryMat);
  pR.position.set(0.48, 0.62, 0);
  torso.add(pL, pR);

  const head = new THREE.Group();
  head.position.set(0, 0.82, 0);
  torso.add(head);

  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), primaryMat);
  helm.position.y = 0.14;
  helm.castShadow = true;
  head.add(helm);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), accentMat);
  eyeL.position.set(-0.08, 0.16, -0.2);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), accentMat);
  eyeR.position.set(0.08, 0.16, -0.2);
  head.add(eyeL, eyeR);

  const wings: THREE.Mesh[] = [];
  if (boss.id === 'gorgath' || boss.id === 'ignis_kael') {
    const hornGeo = new THREE.ConeGeometry(0.075, 0.42, 7);
    const hL = new THREE.Mesh(hornGeo, accentMat);
    hL.position.set(-0.2, 0.34, -0.04);
    hL.rotation.z = 0.65;
    const hR = new THREE.Mesh(hornGeo, accentMat);
    hR.position.set(0.2, 0.34, -0.04);
    hR.rotation.z = -0.65;
    head.add(hL, hR);
  } else if (boss.id === 'vespera') {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 14), accentMat);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 0.34;
    head.add(crown);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.54, 1.05, 10, 1, true), secondaryMat);
    robe.position.y = -0.25;
    torso.add(robe);
  } else if (boss.id === 'malakor') {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 24), accentMat);
    halo.position.set(0, 0.24, 0.15);
    head.add(halo);
    for (let i = 0; i < 4; i++) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 0.04), accentMat);
      const side = i % 2 === 0 ? -1 : 1;
      const tier = i < 2 ? 0.56 : 0.28;
      wing.position.set(side * 0.68, tier, 0.22);
      wing.rotation.z = side * (i < 2 ? 0.35 : -0.15);
      torso.add(wing);
      wings.push(wing);
    }
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.46, 0.54, 0);
  torso.add(leftArm);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.6, 8), primaryMat);
  armL.position.y = -0.28;
  leftArm.add(armL);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.46, 0.54, 0);
  torso.add(rightArm);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.6, 8), primaryMat);
  armR.position.y = -0.28;
  rightArm.add(armR);

  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0, -0.52, -0.18);
  weaponGroup.rotation.x = -Math.PI * 0.38;
  rightArm.add(weaponGroup);

  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.35, 8), secondaryMat);
  haft.position.y = 0.55;
  weaponGroup.add(haft);

  if (boss.id === 'gorgath') {
    const doubleAxe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.62), accentMat);
    doubleAxe.position.y = 1.08;
    weaponGroup.add(doubleAxe);
  } else if (boss.id === 'vespera') {
    const staffHead = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), accentMat);
    staffHead.position.y = 1.28;
    weaponGroup.add(staffHead);
  } else {
    const greatBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.25, 0.22), accentMat);
    greatBlade.position.y = 0.92;
    weaponGroup.add(greatBlade);
  }

  const makeLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.96, 0);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.92, 8), primaryMat);
    mesh.position.y = -0.46;
    mesh.castShadow = true;
    leg.add(mesh);
    return leg;
  };
  const leftLeg = makeLeg(-0.2);
  const rightLeg = makeLeg(0.2);
  actorGroup.add(leftLeg, rightLeg);

  return {
    root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponGroup,
    accentMats: [accentMat],
    wings: wings.length ? wings : undefined,
    telegraphRing,
  };
}

export function buildWorldEnvironment(
  world: WorldDefinition,
  maxAnisotropy: number,
): WorldEnvironmentResult {
  const group = new THREE.Group();
  const platforms: PlatformBox[] = [];
  const ramps: RampSpec[] = [];
  const ziplines: ZiplineAnchor[] = [];
  const flickerLights: WorldEnvironmentResult['flickerLights'] = [];
  const floatingProps: WorldEnvironmentResult['floatingProps'] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const { map, roughnessMap } = createWorldFloorTextures(world.floorTheme, maxAnisotropy);
  disposables.push(map, roughnessMap);

  // Extended terrain beyond playable arena
  const floorGeo = new THREE.PlaneGeometry(240, 240);
  const floorMat = new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    roughness: 0.72,
    metalness: world.floorTheme === 'astral' ? 0.25 : 0.08,
  });
  disposables.push(floorGeo, floorMat);

  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const buildingMat = new THREE.MeshStandardMaterial({
    color:
      world.floorTheme === 'cobble'
        ? 0x9c7b5c
        : world.floorTheme === 'marsh'
          ? 0x4b6b63
          : world.floorTheme === 'lava'
            ? 0x4a2f28
            : 0x3f477a,
    roughness: 0.78,
    metalness: 0.14,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color:
      world.floorTheme === 'cobble'
        ? 0x475569
        : world.floorTheme === 'marsh'
          ? 0x1e3a3a
          : world.floorTheme === 'lava'
            ? 0x292524
            : 0x1e1b4b,
    roughness: 0.52,
    metalness: 0.35,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: world.accentLightColor,
    emissive: world.accentLightColor,
    emissiveIntensity: 0.65,
    roughness: 0.3,
  });
  const cableMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  disposables.push(buildingMat, roofMat, trimMat, cableMat);

  // 4 Multi-level Tactical Bastion Platforms + Ramps for Parkour & Verticality!
  const bastionDefs = [
    { cx: -15, cz: -8, w: 9, d: 9, h: 3.4, rampSide: 'east' as const },
    { cx: 15, cz: -8, w: 9, d: 9, h: 3.4, rampSide: 'west' as const },
    { cx: -15, cz: 10, w: 8, d: 8, h: 2.8, rampSide: 'north' as const },
    { cx: 15, cz: 10, w: 8, d: 8, h: 2.8, rampSide: 'north' as const },
  ];

  bastionDefs.forEach((b) => {
    const block = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), buildingMat);
    block.position.set(b.cx, b.h / 2, b.cz);
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);

    const topCap = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.25, b.d + 0.3), roofMat);
    topCap.position.set(b.cx, b.h - 0.12, b.cz);
    topCap.receiveShadow = true;
    group.add(topCap);

    platforms.push({
      minX: b.cx - b.w / 2,
      maxX: b.cx + b.w / 2,
      minZ: b.cz - b.d / 2,
      maxZ: b.cz + b.d / 2,
      topY: b.h,
    });

    // Sloped ramp leading up to rooftop
    const rampLen = 6.0;
    const rampW = 3.2;
    const hyp = Math.hypot(rampLen, b.h);
    const angle = Math.atan2(b.h, rampLen);
    const rampGeo = new THREE.BoxGeometry(
      b.rampSide === 'north' ? rampW : hyp,
      0.24,
      b.rampSide === 'north' ? hyp : rampW,
    );
    const rampMesh = new THREE.Mesh(rampGeo, roofMat);
    rampMesh.receiveShadow = true;

    if (b.rampSide === 'east') {
      const rx = b.cx + b.w / 2 + rampLen / 2;
      rampMesh.position.set(rx, b.h / 2 - 0.1, b.cz);
      rampMesh.rotation.z = angle;
      ramps.push({
        minX: b.cx + b.w / 2,
        maxX: b.cx + b.w / 2 + rampLen,
        minZ: b.cz - rampW / 2,
        maxZ: b.cz + rampW / 2,
        axis: 'x',
        lowY: 0,
        highY: b.h,
        highAtMax: false,
      });
    } else if (b.rampSide === 'west') {
      const rx = b.cx - b.w / 2 - rampLen / 2;
      rampMesh.position.set(rx, b.h / 2 - 0.1, b.cz);
      rampMesh.rotation.z = -angle;
      ramps.push({
        minX: b.cx - b.w / 2 - rampLen,
        maxX: b.cx - b.w / 2,
        minZ: b.cz - rampW / 2,
        maxZ: b.cz + rampW / 2,
        axis: 'x',
        lowY: 0,
        highY: b.h,
        highAtMax: true,
      });
    } else {
      const rz = b.cz - b.d / 2 - rampLen / 2;
      rampMesh.position.set(b.cx, b.h / 2 - 0.1, rz);
      rampMesh.rotation.x = angle;
      ramps.push({
        minX: b.cx - rampW / 2,
        maxX: b.cx + rampW / 2,
        minZ: b.cz - b.d / 2 - rampLen,
        maxZ: b.cz - b.d / 2,
        axis: 'z',
        lowY: 0,
        highY: b.h,
        highAtMax: true,
      });
    }
    group.add(rampMesh);
  });

  // 4 Vertical Zip-lines (Tyroliennes) just like Bloodstrike for high-altitude gliding & snipes!
  const zipCoords = [
    { id: 'zip_nw', x: -11, z: -18 },
    { id: 'zip_ne', x: 11, z: -18 },
    { id: 'zip_sw', x: -9, z: 16 },
    { id: 'zip_se', x: 9, z: 16 },
  ];

  zipCoords.forEach((zc, idx) => {
    const topY = 15.5;
    const baseRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 24), trimMat);
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.set(zc.x, 0.05, zc.z);
    group.add(baseRing);

    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, topY + 2, 6), cableMat);
    cable.position.set(zc.x, (topY + 2) / 2, zc.z);
    group.add(cable);

    const anchorBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), trimMat);
    anchorBeacon.position.set(zc.x, topY + 0.6, zc.z);
    group.add(anchorBeacon);
    floatingProps.push({ mesh: anchorBeacon, baseY: topY + 0.6, speed: 3.2, phase: idx });

    ziplines.push({ id: zc.id, x: zc.x, z: zc.z, baseY: 0, topY });
  });

  // Outer perimeter towers & industrial/citadel silhouettes + distant ocean/horizon
  const ringGeo = new THREE.RingGeometry(world.arenaRadius - 0.35, world.arenaRadius, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: world.accentLightColor,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
  });
  disposables.push(ringGeo, ringMat);
  const arenaBorderRing = new THREE.Mesh(ringGeo, ringMat);
  arenaBorderRing.rotation.x = -Math.PI / 2;
  arenaBorderRing.position.y = 0.03;
  group.add(arenaBorderRing);

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = world.arenaRadius + 7 + (i % 3) * 5;
    const h = 10 + (i % 4) * 5;
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(6 + (i % 2) * 3, h, 6 + (i % 3) * 2),
      buildingMat,
    );
    tower.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
    tower.castShadow = true;
    group.add(tower);

    const beacon = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 4), trimMat);
    beacon.position.set(Math.cos(angle) * r, h + 0.2, Math.sin(angle) * r);
    group.add(beacon);
  }

  return { group, platforms, ramps, ziplines, flickerLights, floatingProps, disposables };
}
