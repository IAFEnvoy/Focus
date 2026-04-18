// ====== 全局可调参数（便于快速修改） ======
const MOVE_COUNT = 30;
const MOVE_INTERVAL_MS = 320;
const GREEN_HIGHLIGHT_MS = 1000;

// ====== 其余运行参数 ======
const SLOT_COUNT = 8;
const MOVE_ANIMATION_MS = 380;
const FINAL_LAYOUT_MS = 780;
const BASE_ORANGE = "#ff2800";
const TARGET_GREEN = "#43cf61";
const FINAL_COLORS = ["#ff4d4f", "#b9f68f", "#97ddff", "#af82ff", "#ffd86a", "#48cd58", "#3589ff", "#ff8fc7"];
const SPECIAL_MOVE_MODE_ID = "edge-shift-rotate-180";
const SPECIAL_MOVE_REQUIRED_COUNT = 2;
const ARC_SWAP_HORIZONTAL_OFFSET = 10;
const ARC_SWAP_VERTICAL_OFFSET = 8;
const SPECIAL_PAIR_ROTATE_DEG = 180;
const SPECIAL_PAIR_ARC_HORIZONTAL_OFFSET = 14;
const SPECIAL_PAIR_ARC_VERTICAL_OFFSET = 12;
const SPECIAL_BLOCK_ARC_HORIZONTAL_OFFSET = 7;
const SPECIAL_BLOCK_ARC_VERTICAL_OFFSET = 6;

const GRID_COORDS = [
  { x: 29, y: 13 },
  { x: 71, y: 13 },
  { x: 29, y: 36 },
  { x: 71, y: 36 },
  { x: 29, y: 59 },
  { x: 71, y: 59 },
  { x: 29, y: 82 },
  { x: 71, y: 82 }
];

const CIRCLE_COORDS = [
  { x: 50, y: 13 },
  { x: 73.5, y: 24 },
  { x: 82, y: 50 },
  { x: 73.5, y: 76 },
  { x: 50, y: 87 },
  { x: 26.5, y: 76 },
  { x: 18, y: 50 },
  { x: 26.5, y: 24 }
];

const state = {
  keys: [],
  highlightedKeyId: null,
  canSelect: false,
  layout: "grid"
};

const startBtn = document.getElementById("startBtn");
const board = document.getElementById("board");
const statusText = document.getElementById("statusText");
const bgmAudio = document.getElementById("bgmAudio");

preloadBgm();

// 运动模式注册中心：后续新增模式只需往这里增加一个 createPermutation。
const MOVEMENT_MODES = [
  {
    id: "split-rotate",
    createPermutation() {
      const clockwise = Math.random() < 0.5;
      return clockwise
        ? permutationFromCycles(SLOT_COUNT, [[0, 1, 3, 2], [4, 5, 7, 6]])
        : permutationFromCycles(SLOT_COUNT, [[0, 2, 3, 1], [4, 6, 7, 5]]);
    }
  },
  {
    id: "vertical-swap-arc",
    createPermutation() {
      return permutationFromCycles(SLOT_COUNT, [[0, 4], [1, 5], [2, 6], [3, 7]]);
    },
    async perform(moveAnimationMs) {
      const permutation = this.createPermutation();
      await performArcVerticalSwapMove(permutation, moveAnimationMs);
    }
  },
  {
    id: "whole-ring-shift",
    createPermutation() {
      const clockwise = Math.random() < 0.5;
      return clockwise
        ? permutationFromCycles(SLOT_COUNT, [[0, 1, 3, 5, 7, 6, 4, 2]])
        : permutationFromCycles(SLOT_COUNT, [[0, 2, 4, 6, 7, 5, 3, 1]]);
    }
  },
  {
    id: "split-diagonal-swap",
    createPermutation() {
      return permutationFromCycles(SLOT_COUNT, [[0, 3], [1, 2], [4, 7], [5, 6]]);
    }
  },
  {
    id: SPECIAL_MOVE_MODE_ID,
    createMoveConfig() {
      const moveTopToBottom = Math.random() < 0.5;
      return {
        moveTopToBottom,
        permutation: buildEdgeShiftRotate180Permutation(moveTopToBottom)
      };
    },
    createPermutation() {
      return this.createMoveConfig().permutation;
    },
    async perform(moveAnimationMs) {
      const config = this.createMoveConfig();
      await performEdgeShiftRotate180Move(config, moveAnimationMs);
    }
  }
];

startBtn.addEventListener("click", () => {
  playBgmOnce();
  runSequence().catch((error) => {
    console.error(error);
    window.alert("发生错误，请刷新页面后重试。");
  });
});

function preloadBgm() {
  if (!bgmAudio) {
    return;
  }

  bgmAudio.loop = false;
  bgmAudio.preload = "auto";
  bgmAudio.load();
}

function playBgmOnce() {
  if (!bgmAudio) {
    return;
  }

  bgmAudio.loop = false;
  bgmAudio.currentTime = 0;

  const playPromise = bgmAudio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch((error) => {
      console.warn("BGM 播放失败：", error);
    });
  }
}

function initializeKeys() {
  state.keys = [];
  board.innerHTML = "";

  for (let id = 0; id < SLOT_COUNT; id += 1) {
    const keyButton = document.createElement("button");
    keyButton.type = "button";
    keyButton.className = "key";
    keyButton.disabled = true;
    keyButton.dataset.keyId = String(id);
    keyButton.style.setProperty("--key-color", BASE_ORANGE);
    keyButton.style.setProperty("--key-glow", "rgba(255, 183, 95, 0.58)");
    keyButton.addEventListener("click", () => handleKeySelection(id));

    const keyImage = document.createElement("img");
    keyImage.className = "key-image";
    keyImage.src = "key.png";
    keyImage.alt = "";
    keyImage.draggable = false;
    keyImage.setAttribute("aria-hidden", "true");
    keyButton.appendChild(keyImage);

    board.appendChild(keyButton);
    state.keys.push({ id, slot: id, rotationDeg: 0, el: keyButton });
    setKeyRotationVisual(state.keys[state.keys.length - 1], 0);
  }

  setMoveDuration(0);
  applyLayout("grid");
  setMoveDuration(MOVE_ANIMATION_MS);
}

async function runSequence() {
  startBtn.disabled = true;
  startBtn.classList.add("is-hidden");
  board.classList.add("is-visible");
  statusText.textContent = "请记住最先变绿的钥匙。";

  initializeKeys();
  await wait(420);

  const randomKey = state.keys[Math.floor(Math.random() * state.keys.length)];
  state.highlightedKeyId = randomKey.id;
  setColorById(randomKey.id, TARGET_GREEN, "rgba(108, 226, 133, 0.62)");
  await wait(GREEN_HIGHLIGHT_MS);

  setAllKeyColors(BASE_ORANGE, "rgba(255, 183, 95, 0.58)");
  await wait(320);

  statusText.textContent = "钥匙正在移动...";
  await runMoves();

  statusText.textContent = "点击最开始变绿的钥匙。";
  await transitionToFinalCircle();
  enableSelection();
}

async function runMoves() {
  const moveAnimationMs = Math.min(MOVE_ANIMATION_MS, MOVE_INTERVAL_MS);
  setMoveDuration(moveAnimationMs);
  const movePlan = buildMovePlan(MOVE_COUNT);

  for (const mode of movePlan) {
    await executeMoveMode(mode, moveAnimationMs);

    const restMs = Math.max(0, MOVE_INTERVAL_MS - moveAnimationMs);
    if (restMs > 0) {
      await wait(restMs);
    }
  }
}

function buildMovePlan(totalMoves) {
  if (totalMoves < SPECIAL_MOVE_REQUIRED_COUNT) {
    throw new Error("MOVE_COUNT 不能小于特殊动作要求次数。");
  }

  const specialMode = MOVEMENT_MODES.find((mode) => mode.id === SPECIAL_MOVE_MODE_ID);
  const normalModes = MOVEMENT_MODES.filter((mode) => mode.id !== SPECIAL_MOVE_MODE_ID);

  if (!specialMode || normalModes.length === 0) {
    throw new Error("运动模式配置错误：缺少可用动作。");
  }

  const plan = Array.from(
    { length: totalMoves },
    () => normalModes[Math.floor(Math.random() * normalModes.length)]
  );

  const specialIndexes = new Set();
  while (specialIndexes.size < SPECIAL_MOVE_REQUIRED_COUNT) {
    specialIndexes.add(Math.floor(Math.random() * totalMoves));
  }

  for (const index of specialIndexes) {
    plan[index] = specialMode;
  }

  return plan;
}

async function executeMoveMode(mode, moveAnimationMs) {
  if (typeof mode.perform === "function") {
    await mode.perform(moveAnimationMs);
    return;
  }

  const permutation = mode.createPermutation();
  await performPermutationMove(permutation, moveAnimationMs, mode.id);
}

async function performPermutationMove(permutation, moveAnimationMs, modeId) {
  if (!isValidPermutation(permutation)) {
    throw new Error(`Invalid permutation from mode: ${modeId}`);
  }

  applyPermutation(permutation);
  applyLayout("grid");
  await wait(moveAnimationMs);
}

async function performArcVerticalSwapMove(permutation, moveAnimationMs) {
  if (!isValidPermutation(permutation)) {
    throw new Error("Invalid permutation from mode: vertical-swap-arc");
  }

  const startSlotByKeyId = new Map(state.keys.map((key) => [key.id, key.slot]));
  applyPermutation(permutation);

  const motions = state.keys.map((key) => {
    const startSlot = startSlotByKeyId.get(key.id);
    const fromPoint = GRID_COORDS[startSlot];
    const toPoint = GRID_COORDS[key.slot];
    const movingUpward = toPoint.y < fromPoint.y;

    const controlPoint = {
      x: (fromPoint.x + toPoint.x) / 2 + (movingUpward ? -ARC_SWAP_HORIZONTAL_OFFSET : ARC_SWAP_HORIZONTAL_OFFSET),
      y: (fromPoint.y + toPoint.y) / 2 + (movingUpward ? ARC_SWAP_VERTICAL_OFFSET : -ARC_SWAP_VERTICAL_OFFSET)
    };

    return createCurveMotion(key, fromPoint, controlPoint, toPoint, 0);
  });

  await animateCurveMotions(motions, moveAnimationMs);
  setMoveDuration(moveAnimationMs);
}

async function performEdgeShiftRotate180Move(config, moveAnimationMs) {
  const { moveTopToBottom, permutation } = config;

  if (!isValidPermutation(permutation)) {
    throw new Error("Invalid permutation from mode: edge-shift-rotate-180");
  }

  const startSlotByKeyId = new Map(state.keys.map((key) => [key.id, key.slot]));
  const movingPairSlots = moveTopToBottom ? new Set([0, 1]) : new Set([6, 7]);

  applyPermutation(permutation);

  const motions = state.keys.map((key) => {
    const startSlot = startSlotByKeyId.get(key.id);
    const fromPoint = GRID_COORDS[startSlot];
    const toPoint = GRID_COORDS[key.slot];
    const isPairKey = movingPairSlots.has(startSlot);
    const controlPoint = buildSpecialMoveControlPoint(fromPoint, toPoint, isPairKey);
    const rotateDeltaDeg = SPECIAL_PAIR_ROTATE_DEG;

    return createCurveMotion(key, fromPoint, controlPoint, toPoint, rotateDeltaDeg);
  });

  await animateCurveMotions(motions, moveAnimationMs);
  setMoveDuration(moveAnimationMs);
}

function buildEdgeShiftRotate180Permutation(moveTopToBottom) {
  // 规则：上2与下6（或下2与上6）分组做 180 度旋转，最终槽位映射固定为整体反转。
  // moveTopToBottom 只用于控制“哪一组是两把钥匙”的弧线风格，不影响最终映射。
  void moveTopToBottom;
  return [7, 6, 5, 4, 3, 2, 1, 0];
}

function buildSpecialMoveControlPoint(fromPoint, toPoint, isPairKey) {
  const movingUpward = toPoint.y < fromPoint.y;
  const movingLeft = toPoint.x < fromPoint.x;
  const movingRight = toPoint.x > fromPoint.x;
  const midX = (fromPoint.x + toPoint.x) / 2;
  const midY = (fromPoint.y + toPoint.y) / 2;

  let horizontalOffset = 0;
  if (isPairKey) {
    horizontalOffset = fromPoint.x < 50 ? -SPECIAL_PAIR_ARC_HORIZONTAL_OFFSET : SPECIAL_PAIR_ARC_HORIZONTAL_OFFSET;
  } else if (movingLeft) {
    horizontalOffset = -SPECIAL_BLOCK_ARC_HORIZONTAL_OFFSET;
  } else if (movingRight) {
    horizontalOffset = SPECIAL_BLOCK_ARC_HORIZONTAL_OFFSET;
  } else {
    horizontalOffset = fromPoint.x < 50 ? -SPECIAL_BLOCK_ARC_HORIZONTAL_OFFSET : SPECIAL_BLOCK_ARC_HORIZONTAL_OFFSET;
  }

  const verticalOffset = movingUpward ? SPECIAL_BLOCK_ARC_VERTICAL_OFFSET : -SPECIAL_BLOCK_ARC_VERTICAL_OFFSET;
  const pairVerticalOffset = isPairKey
    ? (movingUpward ? SPECIAL_PAIR_ARC_VERTICAL_OFFSET : -SPECIAL_PAIR_ARC_VERTICAL_OFFSET)
    : 0;

  return {
    x: midX + horizontalOffset,
    y: midY + verticalOffset + pairVerticalOffset
  };
}

function createCurveMotion(key, fromPoint, controlPoint, toPoint, rotateDeltaDeg) {
  const startRotationDeg = key.rotationDeg ?? 0;
  return {
    key,
    fromPoint,
    controlPoint,
    toPoint,
    startRotationDeg,
    endRotationDeg: startRotationDeg + rotateDeltaDeg
  };
}

async function animateCurveMotions(motions, durationMs) {
  if (!Array.isArray(motions) || motions.length === 0) {
    return;
  }

  if (durationMs <= 0) {
    for (const motion of motions) {
      setKeyPosition(motion.key, motion.toPoint.x, motion.toPoint.y);
      motion.key.rotationDeg = normalizeDegrees(motion.endRotationDeg);
      setKeyRotationVisual(motion.key, motion.key.rotationDeg);
    }
    return;
  }

  setMoveDuration(0);

  await new Promise((resolve) => {
    const startAt = performance.now();

    const step = (now) => {
      const rawT = clampToUnit((now - startAt) / durationMs);
      const easedT = easeInOutSine(rawT);

      for (const motion of motions) {
        const point = getQuadraticBezierPoint(motion.fromPoint, motion.controlPoint, motion.toPoint, easedT);
        const rotationDeg = motion.startRotationDeg + (motion.endRotationDeg - motion.startRotationDeg) * easedT;
        setKeyPosition(motion.key, point.x, point.y);
        setKeyRotationVisual(motion.key, rotationDeg);
      }

      if (rawT < 1) {
        requestAnimationFrame(step);
        return;
      }

      resolve();
    };

    requestAnimationFrame(step);
  });

  for (const motion of motions) {
    setKeyPosition(motion.key, motion.toPoint.x, motion.toPoint.y);
    motion.key.rotationDeg = normalizeDegrees(motion.endRotationDeg);
    setKeyRotationVisual(motion.key, motion.key.rotationDeg);
  }
}

function getQuadraticBezierPoint(p0, p1, p2, t) {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
    y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y
  };
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function clampToUnit(value) {
  return Math.max(0, Math.min(1, value));
}

function normalizeDegrees(deg) {
  const normalized = deg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

async function transitionToFinalCircle() {
  setMoveDuration(FINAL_LAYOUT_MS);
  applyLayout("circle");

  for (const key of state.keys) {
    const finalColor = FINAL_COLORS[key.slot];
    key.el.style.setProperty("--key-color", finalColor);
    key.el.style.setProperty("--key-glow", `${hexToRgba(finalColor, 0.56)}`);
  }

  await wait(FINAL_LAYOUT_MS + 120);
}

function enableSelection() {
  state.canSelect = true;
  board.classList.add("is-selectable");

  for (const key of state.keys) {
    key.el.disabled = false;
  }
}

function handleKeySelection(id) {
  if (!state.canSelect) {
    return;
  }

  state.canSelect = false;
  board.classList.remove("is-selectable");

  for (const key of state.keys) {
    key.el.disabled = true;
  }

  const result = id === state.highlightedKeyId ? "正确" : "错误";
  window.alert(result);
}

function setAllKeyColors(color, glowColor) {
  for (const key of state.keys) {
    key.el.style.setProperty("--key-color", color);
    key.el.style.setProperty("--key-glow", glowColor);
  }
}

function setColorById(id, color, glowColor) {
  const target = state.keys.find((key) => key.id === id);
  if (!target) {
    return;
  }
  target.el.style.setProperty("--key-color", color);
  target.el.style.setProperty("--key-glow", glowColor);
}

function applyPermutation(permutation) {
  for (const key of state.keys) {
    key.slot = permutation[key.slot];
  }
}

function applyLayout(layoutName) {
  state.layout = layoutName;
  const coords = layoutName === "circle" ? CIRCLE_COORDS : GRID_COORDS;

  for (const key of state.keys) {
    const point = coords[key.slot];
    setKeyPosition(key, point.x, point.y);
  }
}

function setKeyPosition(key, x, y) {
  key.el.style.left = `${x}%`;
  key.el.style.top = `${y}%`;
}

function setKeyRotationVisual(key, deg) {
  key.el.style.setProperty("--key-rotation", `${deg}deg`);
}

function setMoveDuration(ms) {
  board.style.setProperty("--move-ms", `${ms}ms`);
}

function permutationFromCycles(size, cycles) {
  const permutation = Array.from({ length: size }, (_, i) => i);

  for (const cycle of cycles) {
    for (let i = 0; i < cycle.length; i += 1) {
      const from = cycle[i];
      const to = cycle[(i + 1) % cycle.length];
      permutation[from] = to;
    }
  }

  return permutation;
}

function isValidPermutation(permutation) {
  if (!Array.isArray(permutation) || permutation.length !== SLOT_COUNT) {
    return false;
  }

  const values = new Set(permutation);
  if (values.size !== SLOT_COUNT) {
    return false;
  }

  for (const value of values) {
    if (value < 0 || value >= SLOT_COUNT) {
      return false;
    }
  }

  return true;
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const isShort = clean.length === 3;
  const r = parseInt(isShort ? clean[0] + clean[0] : clean.slice(0, 2), 16);
  const g = parseInt(isShort ? clean[1] + clean[1] : clean.slice(2, 4), 16);
  const b = parseInt(isShort ? clean[2] + clean[2] : clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
