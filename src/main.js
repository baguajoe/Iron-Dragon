import * as THREE from 'three'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x050015)
scene.fog = new THREE.FogExp2(0x050015, 0.02)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 2, 8)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

// Procedural sound effects via the Web Audio API (no external files)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

// Play a single oscillator tone that sweeps frequency and fades its gain out cleanly
function playTone(type, freqStart, freqEnd, duration, gain = 0.3) {
  // Browsers start the context suspended until a user gesture; resume on demand
  if (audioCtx.state === 'suspended') audioCtx.resume()
  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freqStart, now)
  osc.frequency.linearRampToValueAtTime(freqEnd, now + duration)
  gainNode.gain.setValueAtTime(gain, now)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  osc.connect(gainNode)
  gainNode.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + duration)
}

// Hit: short sharp thud when a J attack lands
const playHitSound = () => playTone('sawtooth', 150, 50, 0.1)
// Chi charge: rising tone when the Chi stage increases
const playChiChargeSound = () => playTone('sine', 200, 400, 0.3)
// Dragon Pulse: descending whoosh when K fires
const playDragonPulseSound = () => playTone('sine', 300, 100, 0.4)
// Iron Shirt: metallic clang when I activates
const playIronShirtSound = () => playTone('square', 400, 400, 0.2)

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 5),
  new THREE.MeshStandardMaterial({ color: 0x1a0a2e })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

scene.add(new THREE.AmbientLight(0xffffff, 0.6))
const sun = new THREE.DirectionalLight(0xffffff, 1.2)
sun.position.set(5, 10, 5)
sun.castShadow = true
scene.add(sun)

// Torches lining the arena cast a flickering orange glow
for (const torchX of [-6, -2, 2, 6]) {
  const torch = new THREE.PointLight(0xff6600, 2, 8)
  torch.position.set(torchX, 3, -2)
  scene.add(torch)
}

// Arena room: walls, ceiling, pillars, and portrait frames
const backWall = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 12),
  new THREE.MeshStandardMaterial({ color: 0x0d0820 })
)
backWall.position.set(0, 5, -4)
backWall.receiveShadow = true
scene.add(backWall)

const leftWall = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ color: 0x0d0820 })
)
leftWall.position.set(-8, 5, 0)
leftWall.rotation.y = Math.PI / 2
leftWall.receiveShadow = true
scene.add(leftWall)

const rightWall = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ color: 0x0d0820 })
)
rightWall.position.set(8, 5, 0)
rightWall.rotation.y = -Math.PI / 2
rightWall.receiveShadow = true
scene.add(rightWall)

const ceiling = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 10),
  new THREE.MeshStandardMaterial({ color: 0x080010 })
)
ceiling.position.set(0, 10, 0)
ceiling.rotation.x = Math.PI / 2
scene.add(ceiling)

for (const pillarX of [-6, -3, 3, 6]) {
  const pillar = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 3, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x1a1030 })
  )
  pillar.position.set(pillarX, 1.5, -2)
  pillar.castShadow = true
  pillar.receiveShadow = true
  scene.add(pillar)
}

for (const frameX of [-4, 0, 4]) {
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 2, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x2a1040 })
  )
  frame.position.set(frameX, 5, -3.9)
  scene.add(frame)
}

const ironDragon = new THREE.Mesh(
  new THREE.BoxGeometry(1, 2, 1),
  new THREE.MeshStandardMaterial({ color: 0x00ff88 })
)
ironDragon.position.set(-2, 1, 0)
ironDragon.castShadow = true
scene.add(ironDragon)

const opponent = new THREE.Mesh(
  new THREE.BoxGeometry(1, 2, 1),
  new THREE.MeshStandardMaterial({ color: 0xff2200 })
)
opponent.position.set(2, 1, 0)
opponent.castShadow = true
scene.add(opponent)

const keys = {}
window.addEventListener('keydown', e => { keys[e.code] = true; idleTimer = 0 })
window.addEventListener('keyup', e => { keys[e.code] = false })

let ironDragonHealth = 100
let opponentHealth = 100
let ironDragonAttacking = false
let attackTimer = 0
const ATTACK_DURATION = 0.3
const ATTACK_RANGE = 2.5
let hitstopTimer = 0
const HITSTOP_DURATION = 0.1
let opponentFlashTimer = 0
let attackHit = false
let gameOver = false

// Game mode: 'fight' (the existing battle) or 'explore'. A title screen gates the start.
let gameMode = 'fight'
let onTitle = true

// Best of 3 rounds: first to ROUNDS_TO_WIN takes the match
const roundsWon = { ironDragon: 0, opponent: 0 }
const ROUNDS_TO_WIN = 2
let currentRound = 1
let roundTransition = false
let roundTransitionTimer = 0
const ROUND_TRANSITION_DURATION = 2

let opponentAttackTimer = 0
const OPPONENT_ATTACK_INTERVAL = 2
const OPPONENT_ATTACK_RANGE = 2.5
const OPPONENT_DAMAGE = 10
const OPPONENT_SPEED = 0.02
const AI_MIN_DISTANCE = 2
// Vampire speed: the Lieutenant blinks 1 unit closer every few seconds with a red flash
let vampireTeleportTimer = 0
const VAMPIRE_TELEPORT_INTERVAL = 5
let redirectWindow = 0
let lastDamageTaken = 0
const REDIRECT_WINDOW_DURATION = 0.5
const REDIRECT_DAMAGE = 20
// Ward Off (U): deflect an incoming attack. Push (O): no-Chi palm strike on a cooldown.
let wardOffTimer = 0
let wardOffTextTimer = 0
let pushCooldown = 0
const WARD_OFF_DAMAGE = 10
const WARD_OFF_ROT_DURATION = 0.5
const PUSH_DAMAGE = 12
const PUSH_KNOCKBACK = 3
const PUSH_COOLDOWN = 1
// Rollback (Y): grab momentum and pull the opponent past. Press (P): unblockable close strike.
let rollbackTextTimer = 0
let pressCooldown = 0
let pressTextTimer = 0
const ROLLBACK_DAMAGE = 15
const PRESS_DAMAGE = 25
const PRESS_RANGE = 1.5
const PRESS_COOLDOWN = 2
let ironDragonFlashTimer = 0
let roundTimer = 0
const AI_START_DELAY = 2

// Iron Qigong: stand still for QIGONG_DELAY seconds to slowly regenerate health
let idleTimer = 0
let isHealing = false
let qigongPulsing = false
const QIGONG_DELAY = 0.5
const QIGONG_HEAL_RATE = 8

let chi = 0
let chiStage = 1
let chiStageTextTimer = 0
const CHI_MAX = 100
const CHI_PER_HIT = 12
const CHI_PULSE_THRESHOLD = 50
const CHI_PULSE_COST = 50
let ironShirtActive = false
let ironShirtTimer = 0
const IRON_SHIRT_COST = 40
const IRON_SHIRT_DURATION = 3
const IRON_SHIRT_COLOR = 0x444444
// Iron Qigong power boost: attacks hit harder while Iron Shirt is active
const IRON_SHIRT_DAMAGE_MULT = 1.2
const PULSE_SPEED = 0.15
const PULSE_REMOVE_X = 10
const PULSE_DAMAGE = 35
const PULSE_HIT_RANGE = 1.2
let dragonPulse = null
let pulseDirection = 1
let pulseStartX = 0

const J_DAMAGE = 15
// Bagua circle stepping: double-tap A/D to dash beside the opponent into an advantageous stance
let baguaBuffTimer = 0
let lastTapTimeA = -Infinity
let lastTapTimeD = -Infinity
const DOUBLE_TAP_WINDOW = 0.3
const BAGUA_BUFF_DURATION = 1
const BAGUA_DAMAGE_MULT = 1.5
const BAGUA_STEP_OFFSET = 2
let baguaDashing = false
let baguaTargetX = 0
// Knockdown: only the Dragon Pulse knocks the opponent down
const FALL_ROTATION = 1.5
const FALL_KNOCKBACK = 2
const FALL_DURATION = 1
let opponentFallTimer = 0

// Opponent falls flat on its back, gets knocked 2 units right, then stands up after FALL_DURATION
function knockDownOpponent() {
  opponent.rotation.z = FALL_ROTATION
  opponent.position.x = Math.min(7, opponent.position.x + FALL_KNOCKBACK)
  opponentFallTimer = FALL_DURATION
}

// Iron Dragon's resting color ramps through five Chi stages: green → teal → gold → orange → white
const CHI_STAGE_COLORS = [0x00ff88, 0x00ccff, 0xffd700, 0xff6600, 0xffffff]
function getChiStage() {
  if (chi < 20) return 1
  if (chi < 40) return 2
  if (chi < 60) return 3
  if (chi < 80) return 4
  return 5
}

// Iron Shirt grey and Bagua orange override the Chi-stage color; otherwise color by Chi stage.
function ironDragonBaseColor() {
  if (ironShirtActive) return IRON_SHIRT_COLOR
  if (baguaBuffTimer > 0) return 0xff8800
  return CHI_STAGE_COLORS[getChiStage() - 1]
}

// Iron Qigong power boost applied to every Iron Dragon attack while Iron Shirt is active
function damageBoost() {
  return ironShirtActive ? IRON_SHIRT_DAMAGE_MULT : 1
}

// Dash to the side of the opponent and enter the advantageous Bagua stance (side: -1 left, +1 right)
function baguaStep(side) {
  baguaTargetX = Math.max(-7, Math.min(7, opponent.position.x + side * BAGUA_STEP_OFFSET))
  baguaDashing = true
  baguaBuffTimer = BAGUA_BUFF_DURATION
  if (!ironDragonAttacking) {
    ironDragon.material.color.setHex(0xff8800)
  }
}

const hud = document.createElement('div')
hud.style.cssText = "position:fixed;top:0;left:0;width:100%;pointer-events:none;z-index:999;font-family:Arial;box-sizing:border-box;padding:16px;"
document.body.appendChild(hud)

hud.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div style="width:35%;">
      <div style="color:#00ff88;font-weight:bold;font-size:13px;margin-bottom:4px;">IRON DRAGON</div>
      <div style="background:#333;border:2px solid #00ff88;height:22px;border-radius:3px;overflow:hidden;">
        <div id="p1fill" style="width:100%;height:100%;background:#00ff88;transition:width 0.15s;"></div>
      </div>
      <div style="color:#ffd700;font-weight:bold;font-size:11px;margin:6px 0 4px;">CHI</div>
      <div style="background:#333;border:2px solid #ffd700;height:14px;border-radius:3px;overflow:hidden;">
        <div id="chifill" style="width:0%;height:100%;background:#ffd700;transition:width 0.15s;"></div>
      </div>
    </div>
    <div style="color:white;font-size:18px;font-weight:bold;text-align:center;padding-top:4px;">
      <div id="roundtext">ROUND 1</div>
      <div id="roundscore" style="font-size:22px;margin-top:4px;">0-0</div>
    </div>
    <div style="width:35%;text-align:right;">
      <div style="color:#ff2200;font-weight:bold;font-size:13px;margin-bottom:4px;">VAMPIRE LIEUTENANT</div>
      <div style="background:#333;border:2px solid #ff2200;height:22px;border-radius:3px;overflow:hidden;display:flex;justify-content:flex-end;">
        <div id="p2fill" style="width:100%;height:100%;background:#ff2200;transition:width 0.15s;"></div>
      </div>
    </div>
  </div>
`

const p1Fill = document.getElementById('p1fill')
const p2Fill = document.getElementById('p2fill')
const chiFill = document.getElementById('chifill')
const roundText = document.getElementById('roundtext')
const roundScore = document.getElementById('roundscore')

const winScreen = document.createElement('div')
winScreen.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#00ff88;font-family:Arial;font-size:52px;font-weight:bold;z-index:9999;display:none;text-shadow:0 0 20px #00ff88;text-align:center;"
document.body.appendChild(winScreen)

const roundMsg = document.createElement('div')
roundMsg.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#00ff88;font-family:Arial;font-size:48px;font-weight:bold;z-index:9999;display:none;text-shadow:0 0 20px #00ff88;text-align:center;pointer-events:none;"
document.body.appendChild(roundMsg)

const redirectText = document.createElement('div')
redirectText.style.cssText = "position:fixed;top:35%;left:50%;transform:translate(-50%,-50%);color:#3399ff;font-family:Arial;font-size:48px;font-weight:bold;z-index:9999;display:none;text-shadow:0 0 20px #3399ff;pointer-events:none;"
redirectText.textContent = 'REDIRECTED'
document.body.appendChild(redirectText)

const ironShirtText = document.createElement('div')
ironShirtText.style.cssText = "position:fixed;top:25%;left:50%;transform:translate(-50%,-50%);color:#aaaaaa;font-family:Arial;font-size:48px;font-weight:bold;z-index:9999;display:none;text-shadow:0 0 20px #888888;pointer-events:none;"
ironShirtText.textContent = 'IRON SHIRT'
document.body.appendChild(ironShirtText)

const healingText = document.createElement('div')
healingText.style.cssText = "position:fixed;top:45%;left:50%;transform:translate(-50%,-50%);color:#00ff88;font-family:Arial;font-size:40px;font-weight:bold;z-index:9999;display:none;text-shadow:0 0 20px #00ff88;pointer-events:none;"
healingText.textContent = 'HEALING'
document.body.appendChild(healingText)

const chiStageText = document.createElement('div')
chiStageText.style.cssText = "position:fixed;top:18%;left:50%;transform:translate(-50%,-50%);font-family:Arial;font-size:36px;font-weight:bold;z-index:9999;display:none;pointer-events:none;"
document.body.appendChild(chiStageText)

const wardOffText = document.createElement('div')
wardOffText.style.cssText = "position:fixed;top:35%;left:50%;transform:translate(-50%,-50%);color:#00ffff;font-family:Arial;font-size:48px;font-weight:bold;z-index:9999;display:none;text-shadow:0 0 20px #00ffff;pointer-events:none;"
wardOffText.textContent = 'WARD OFF'
document.body.appendChild(wardOffText)

const rollbackText = document.createElement('div')
rollbackText.style.cssText = "position:fixed;top:35%;left:50%;transform:translate(-50%,-50%);color:#aa44ff;font-family:Arial;font-size:48px;font-weight:bold;z-index:9999;display:none;text-shadow:0 0 20px #aa44ff;pointer-events:none;"
rollbackText.textContent = 'ROLLBACK'
document.body.appendChild(rollbackText)

const pressText = document.createElement('div')
pressText.style.cssText = "position:fixed;top:55%;left:50%;transform:translate(-50%,-50%);color:#ffffff;font-family:Arial;font-size:48px;font-weight:bold;z-index:9999;display:none;text-shadow:0 0 20px #ffffff;pointer-events:none;"
pressText.textContent = 'PRESS'
document.body.appendChild(pressText)
let redirectTextTimer = 0

const controls = document.createElement('div')
controls.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);color:#666;font-family:Arial;font-size:12px;z-index:999;text-align:center;"
controls.innerHTML = "A/D = Move Iron Dragon &nbsp;|&nbsp; Arrow Keys = Move Opponent &nbsp;|&nbsp; J = Attack &nbsp;|&nbsp; K = Dragon Pulse (50 Chi) &nbsp;|&nbsp; L = Tai Chi Redirect &nbsp;|&nbsp; AA/DD = Bagua Step &nbsp;|&nbsp; I = Iron Shirt (40 Chi) &nbsp;|&nbsp; U = Ward Off &nbsp;|&nbsp; O = Push &nbsp;|&nbsp; Y = Rollback &nbsp;|&nbsp; P = Press"
document.body.appendChild(controls)

window.addEventListener('keydown', e => {
  // Fight inputs are inert on the title screen and in explore mode
  if (onTitle || gameMode !== 'fight') return
  // Bagua circle stepping: a second A/D tap within DOUBLE_TAP_WINDOW dashes beside the opponent
  if (e.code === 'KeyA' && !gameOver && !e.repeat) {
    const now = performance.now() / 1000
    if (now - lastTapTimeA < DOUBLE_TAP_WINDOW) {
      baguaStep(-1)
      lastTapTimeA = -Infinity
    } else {
      lastTapTimeA = now
    }
  }
  if (e.code === 'KeyD' && !gameOver && !e.repeat) {
    const now = performance.now() / 1000
    if (now - lastTapTimeD < DOUBLE_TAP_WINDOW) {
      baguaStep(1)
      lastTapTimeD = -Infinity
    } else {
      lastTapTimeD = now
    }
  }
  if (e.code === 'KeyJ' && !ironDragonAttacking && !gameOver) {
    ironDragonAttacking = true
    attackTimer = 0
    attackHit = false
    ironDragon.material.color.setHex(0xffff00)
  }
  if (e.code === 'KeyK') {
    console.log('K pressed — current Chi:', chi)
  }
  if (e.code === 'KeyK' && !gameOver && !dragonPulse && chi >= CHI_PULSE_THRESHOLD) {
    chi -= CHI_PULSE_COST
    playDragonPulseSound()
    updateChiBar()
    dragonPulse = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    )
    pulseDirection = opponent.position.x > ironDragon.position.x ? 1 : -1
    pulseStartX = ironDragon.position.x + 1.5 * pulseDirection
    dragonPulse.position.set(pulseStartX, 1, 0)
    scene.add(dragonPulse)
    console.log('Dragon Pulse created at x:', dragonPulse.position.x)
    // Drop out of full-power white once Chi falls below max (unless mid-attack/flash)
    if (!ironDragonAttacking && ironDragonFlashTimer <= 0) {
      ironDragon.material.color.setHex(ironDragonBaseColor())
    }
  }
  // Tai Chi redirect: press L within the window after being hit to reverse the attack
  if (e.code === 'KeyL' && !gameOver && redirectWindow > 0) {
    redirectWindow = 0
    // Cancel and restore the damage Iron Dragon just took
    ironDragonHealth = Math.min(100, ironDragonHealth + lastDamageTaken)
    // Knock the opponent back 2 units, away from Iron Dragon, using their own force
    const redirectDir = opponent.position.x > ironDragon.position.x ? 1 : -1
    opponent.position.x += redirectDir * 2
    opponent.position.x = Math.max(-7, Math.min(7, opponent.position.x))
    opponentHealth = Math.max(0, opponentHealth - REDIRECT_DAMAGE * damageBoost())
    updateHealthBars()
    // Flash Iron Dragon blue to show the redirect activated
    ironDragon.material.color.setHex(0x3399ff)
    ironDragonFlashTimer = 0.3
    // Show REDIRECTED text briefly
    redirectText.style.display = 'block'
    redirectTextTimer = 0.8
    if (opponentHealth <= 0) {
      showWinner('IRON DRAGON WINS!')
    }
  }
  // Iron Shirt: spend Chi to become invulnerable for a few seconds
  if (e.code === 'KeyI' && !gameOver && !ironShirtActive && chi >= IRON_SHIRT_COST) {
    chi -= IRON_SHIRT_COST
    playIronShirtSound()
    updateChiBar()
    ironShirtActive = true
    ironShirtTimer = IRON_SHIRT_DURATION
    ironShirtText.style.display = 'block'
    // Shift to dark grey metallic immediately unless mid-attack
    if (!ironDragonAttacking) {
      ironDragon.material.color.setHex(ironDragonBaseColor())
    }
  }
  // Ward Off: press U while the opponent is attacking to deflect the blow
  if (e.code === 'KeyU' && !gameOver && redirectWindow > 0) {
    redirectWindow = 0
    // Cancel the incoming damage and counter
    ironDragonHealth = Math.min(100, ironDragonHealth + lastDamageTaken)
    opponentHealth = Math.max(0, opponentHealth - WARD_OFF_DAMAGE * damageBoost())
    updateHealthBars()
    // Tip the opponent backward briefly
    opponent.rotation.z = -0.5
    wardOffTimer = WARD_OFF_ROT_DURATION
    // Show WARD OFF text in cyan
    wardOffText.style.display = 'block'
    wardOffTextTimer = 0.8
    if (opponentHealth <= 0) {
      showWinner('IRON DRAGON WINS!')
    }
  }
  // Push: double palm push, no Chi cost, knocks the opponent back on a short cooldown
  if (e.code === 'KeyO' && !gameOver && pushCooldown <= 0) {
    pushCooldown = PUSH_COOLDOWN
    const pushDir = opponent.position.x > ironDragon.position.x ? 1 : -1
    opponent.position.x += pushDir * PUSH_KNOCKBACK
    opponent.position.x = Math.max(-7, Math.min(7, opponent.position.x))
    opponentHealth = Math.max(0, opponentHealth - PUSH_DAMAGE * damageBoost())
    updateHealthBars()
    opponent.material.color.setHex(0xffffff)
    opponentFlashTimer = 0.1
    if (opponentHealth <= 0) {
      showWinner('IRON DRAGON WINS!')
    }
  }
  // Rollback: press Y while the opponent is attacking to grab their momentum and pull them past
  if (e.code === 'KeyY' && !gameOver && redirectWindow > 0) {
    redirectWindow = 0
    // Cancel the incoming damage
    ironDragonHealth = Math.min(100, ironDragonHealth + lastDamageTaken)
    // Continue their momentum: drag them 2 units past Iron Dragon in their travel direction
    const momentumDir = ironDragon.position.x > opponent.position.x ? 1 : -1
    opponent.position.x = ironDragon.position.x + momentumDir * 2
    opponent.position.x = Math.max(-7, Math.min(7, opponent.position.x))
    opponentHealth = Math.max(0, opponentHealth - ROLLBACK_DAMAGE * damageBoost())
    updateHealthBars()
    // Show ROLLBACK text in purple
    rollbackText.style.display = 'block'
    rollbackTextTimer = 0.8
    if (opponentHealth <= 0) {
      showWinner('IRON DRAGON WINS!')
    }
  }
  // Press: two-handed unblockable forward strike, big damage at close range, long cooldown
  if (e.code === 'KeyP' && !gameOver && pressCooldown <= 0) {
    pressCooldown = PRESS_COOLDOWN
    const pressDistance = Math.abs(opponent.position.x - ironDragon.position.x)
    if (pressDistance <= PRESS_RANGE) {
      opponentHealth = Math.max(0, opponentHealth - PRESS_DAMAGE * damageBoost())
      updateHealthBars()
      opponent.material.color.setHex(0xffffff)
      opponentFlashTimer = 0.1
      if (opponentHealth <= 0) {
        showWinner('IRON DRAGON WINS!')
      }
    }
    // Show PRESS text in white
    pressText.style.display = 'block'
    pressTextTimer = 0.8
  }
})

function updateHealthBars() {
  p1Fill.style.width = Math.max(0, ironDragonHealth) + '%'
  p2Fill.style.width = Math.max(0, opponentHealth) + '%'
}

function updateChiBar() {
  chiFill.style.width = Math.max(0, Math.min(CHI_MAX, chi)) + '%'
}

function updateRoundScore() {
  roundScore.textContent = roundsWon.ironDragon + '-' + roundsWon.opponent
}

// Reset health, Chi, positions, and all transient combat state for a fresh round
function resetRoundState() {
  ironDragonHealth = 100
  opponentHealth = 100
  chi = 0
  chiStage = 1
  chiStageTextTimer = 0
  chiStageText.style.display = 'none'
  ironDragonAttacking = false
  attackTimer = 0
  attackHit = false
  hitstopTimer = 0
  opponentAttackTimer = 0
  ironDragonFlashTimer = 0
  roundTimer = 0
  vampireTeleportTimer = 0
  if (dragonPulse) {
    scene.remove(dragonPulse)
    dragonPulse = null
  }
  opponentFallTimer = 0
  opponent.rotation.z = 0
  redirectWindow = 0
  redirectTextTimer = 0
  redirectText.style.display = 'none'
  wardOffTimer = 0
  wardOffTextTimer = 0
  wardOffText.style.display = 'none'
  pushCooldown = 0
  rollbackTextTimer = 0
  rollbackText.style.display = 'none'
  pressCooldown = 0
  pressTextTimer = 0
  pressText.style.display = 'none'
  baguaBuffTimer = 0
  baguaDashing = false
  lastTapTimeA = -Infinity
  lastTapTimeD = -Infinity
  ironShirtActive = false
  ironShirtTimer = 0
  ironShirtText.style.display = 'none'
  idleTimer = 0
  isHealing = false
  qigongPulsing = false
  healingText.style.display = 'none'
  ironDragon.position.set(-2, 1, 0)
  opponent.position.set(2, 1, 0)
  ironDragon.material.color.setHex(0x00ff88)
  opponent.material.color.setHex(0xff2200)
  updateHealthBars()
  updateChiBar()
}

// Show the final victory screen for the match winner
function showFinalWinner(text) {
  gameOver = true
  const color = text.startsWith('VAMPIRE') ? '#ff2200' : '#00ff88'
  winScreen.style.color = color
  winScreen.style.textShadow = '0 0 20px ' + color
  winScreen.style.display = 'block'
  winScreen.innerHTML = text + '<br><span style="font-size:18px;color:white;">Press R to restart</span>'
}

// A character's health hit zero: award the round, then end the match or transition to the next round
function showWinner(text) {
  if (gameOver || roundTransition) return
  const winner = text.startsWith('VAMPIRE') ? 'opponent' : 'ironDragon'
  roundsWon[winner] += 1
  updateRoundScore()
  if (roundsWon[winner] >= ROUNDS_TO_WIN) {
    showFinalWinner(winner === 'opponent' ? 'VAMPIRE LIEUTENANT WINS' : 'IRON DRAGON WINS!')
    return
  }
  // Round won but match continues: announce and pause before the next round
  roundTransition = true
  roundTransitionTimer = ROUND_TRANSITION_DURATION
  const color = winner === 'opponent' ? '#ff2200' : '#00ff88'
  roundMsg.textContent = 'ROUND ' + currentRound + ' COMPLETE'
  roundMsg.style.color = color
  roundMsg.style.textShadow = '0 0 20px ' + color
  roundMsg.style.display = 'block'
}

// Advance to and set up the next round after the transition pause
function startNextRound() {
  currentRound += 1
  roundTransition = false
  roundMsg.style.display = 'none'
  roundText.textContent = 'ROUND ' + currentRound
  resetRoundState()
}

window.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && gameOver) {
    gameOver = false
    roundsWon.ironDragon = 0
    roundsWon.opponent = 0
    currentRound = 1
    roundTransition = false
    roundTransitionTimer = 0
    roundMsg.style.display = 'none'
    updateRoundScore()
    winScreen.style.display = 'none'
    roundText.textContent = 'ROUND 1'
    resetRoundState()
  }
})

// ---------------------------------------------------------------------------
// Title screen + Exploration mode
// ---------------------------------------------------------------------------

const titleScreen = document.createElement('div')
titleScreen.style.cssText = "position:fixed;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10000;font-family:Arial;"
const titleHeading = document.createElement('div')
titleHeading.textContent = 'IRON DRAGON'
titleHeading.style.cssText = "color:#ffd700;font-size:84px;font-weight:bold;text-shadow:0 0 30px #ffd700;letter-spacing:6px;margin-bottom:48px;"
titleScreen.appendChild(titleHeading)
const titleButtons = document.createElement('div')
titleButtons.style.cssText = "display:flex;gap:32px;"
titleScreen.appendChild(titleButtons)
function makeMenuButton(label) {
  const b = document.createElement('button')
  b.textContent = label
  b.style.cssText = "padding:18px 36px;font-size:22px;font-weight:bold;font-family:Arial;color:#ffd700;background:#1a0a2e;border:2px solid #ffd700;border-radius:8px;cursor:pointer;"
  return b
}
const fightBtn = makeMenuButton('FIGHT MODE')
const exploreBtn = makeMenuButton('EXPLORE MODE')
titleButtons.appendChild(fightBtn)
titleButtons.appendChild(exploreBtn)
document.body.appendChild(titleScreen)

// Exploration HUD elements
const explorePrompt = document.createElement('div')
explorePrompt.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);color:#ffd700;font-family:Arial;font-size:22px;font-weight:bold;z-index:999;display:none;text-shadow:0 0 12px #ffd700;pointer-events:none;"
explorePrompt.textContent = 'Press E to pick up'
document.body.appendChild(explorePrompt)

const exploreMsg = document.createElement('div')
exploreMsg.style.cssText = "position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);color:#ffd700;font-family:Arial;font-size:38px;font-weight:bold;z-index:999;display:none;text-shadow:0 0 20px #ffd700;pointer-events:none;text-align:center;white-space:pre;"
document.body.appendChild(exploreMsg)

const exploreControls = document.createElement('div')
exploreControls.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);color:#888;font-family:Arial;font-size:14px;z-index:999;display:none;text-align:center;"
exploreControls.innerHTML = "W = Walk Forward &nbsp;|&nbsp; S = Walk Back &nbsp;|&nbsp; E = Pick Up"
document.body.appendChild(exploreControls)

// Exploration scene + state
const exploreGroup = new THREE.Group()
let exploreBuilt = false
const pickups = []
const PICKUP_NAMES = ['JADE AMULET', 'ANCIENT SCROLL', 'CHI CRYSTAL']
const PICKUP_RANGE = 2.5
const EXPLORE_SPEED = 0.12
const EXPLORE_Z_MIN = -46
const EXPLORE_Z_MAX = 4
let pickupsCollected = 0
let exploreMsgTimer = 0

function buildExploreScene() {
  if (exploreBuilt) return
  exploreBuilt = true
  const corridorFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 60),
    new THREE.MeshStandardMaterial({ color: 0x120a1e })
  )
  corridorFloor.rotation.x = -Math.PI / 2
  corridorFloor.position.set(0, 0, -22)
  corridorFloor.receiveShadow = true
  exploreGroup.add(corridorFloor)

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d0820 })
  const leftCorridorWall = new THREE.Mesh(new THREE.PlaneGeometry(60, 8), wallMat)
  leftCorridorWall.position.set(-4, 4, -22)
  leftCorridorWall.rotation.y = Math.PI / 2
  exploreGroup.add(leftCorridorWall)
  const rightCorridorWall = new THREE.Mesh(new THREE.PlaneGeometry(60, 8), wallMat)
  rightCorridorWall.position.set(4, 4, -22)
  rightCorridorWall.rotation.y = -Math.PI / 2
  exploreGroup.add(rightCorridorWall)
  const corridorCeiling = new THREE.Mesh(new THREE.PlaneGeometry(8, 60), wallMat)
  corridorCeiling.position.set(0, 8, -22)
  corridorCeiling.rotation.x = Math.PI / 2
  exploreGroup.add(corridorCeiling)

  // Soft lamps spaced down the corridor
  for (const lampZ of [-2, -16, -30, -44]) {
    const lamp = new THREE.PointLight(0xffd700, 1.2, 20)
    lamp.position.set(0, 6, lampZ)
    exploreGroup.add(lamp)
  }

  // 3 glowing gold pickups on the floor
  const pickupZs = [-10, -25, -40]
  pickupZs.forEach((pz, i) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.8 })
    )
    mesh.position.set(0, 0.5, pz)
    exploreGroup.add(mesh)
    const glow = new THREE.PointLight(0xffd700, 1.5, 5)
    glow.position.set(0, 0.6, pz)
    exploreGroup.add(glow)
    pickups.push({ mesh, glow, name: PICKUP_NAMES[i], collected: false })
  })

  scene.add(exploreGroup)
}

function startFightMode() {
  if (audioCtx.state === 'suspended') audioCtx.resume()
  gameMode = 'fight'
  onTitle = false
  titleScreen.style.display = 'none'
}

function startExploreMode() {
  if (audioCtx.state === 'suspended') audioCtx.resume()
  gameMode = 'explore'
  onTitle = false
  titleScreen.style.display = 'none'
  // Hide the fight HUD
  hud.style.display = 'none'
  controls.style.display = 'none'
  // Hide every fight-scene mesh (arena + Vampire Lieutenant), keeping Iron Dragon
  scene.traverse(obj => {
    if (obj.isMesh && obj !== ironDragon) obj.visible = false
  })
  buildExploreScene()
  exploreGroup.visible = true
  // Drop Iron Dragon at the corridor entrance, facing down the hall
  ironDragon.position.set(0, 1, EXPLORE_Z_MAX - 2)
  ironDragon.rotation.set(0, 0, 0)
  ironDragon.material.color.setHex(0x00ff88)
  exploreControls.style.display = 'block'
}

fightBtn.addEventListener('click', startFightMode)
exploreBtn.addEventListener('click', startExploreMode)

// E to collect a nearby pickup while exploring
window.addEventListener('keydown', e => {
  if (onTitle || gameMode !== 'explore' || e.code !== 'KeyE') return
  for (const p of pickups) {
    if (p.collected) continue
    const near = Math.abs(ironDragon.position.z - p.mesh.position.z) < PICKUP_RANGE &&
      Math.abs(ironDragon.position.x - p.mesh.position.x) < PICKUP_RANGE
    if (near) {
      p.collected = true
      p.mesh.visible = false
      p.glow.visible = false
      pickupsCollected += 1
      exploreMsg.textContent = 'PICKED UP\n' + p.name + '  (' + pickupsCollected + '/3)'
      exploreMsg.style.display = 'block'
      exploreMsgTimer = 1.8
      playChiChargeSound()
      break
    }
  }
})

function updateExplore(delta) {
  // Walk forward / backward along the corridor
  if (keys['KeyW']) ironDragon.position.z -= EXPLORE_SPEED
  if (keys['KeyS']) ironDragon.position.z += EXPLORE_SPEED
  ironDragon.position.z = Math.max(EXPLORE_Z_MIN, Math.min(EXPLORE_Z_MAX, ironDragon.position.z))

  // Third-person camera trailing behind Iron Dragon
  camera.position.set(ironDragon.position.x, ironDragon.position.y + 3, ironDragon.position.z + 6)
  camera.lookAt(ironDragon.position.x, ironDragon.position.y, ironDragon.position.z - 4)

  // Spin the pickups and show the prompt when standing near an uncollected one
  let nearAny = false
  for (const p of pickups) {
    if (p.collected) continue
    p.mesh.rotation.y += delta * 2
    if (Math.abs(ironDragon.position.z - p.mesh.position.z) < PICKUP_RANGE &&
        Math.abs(ironDragon.position.x - p.mesh.position.x) < PICKUP_RANGE) {
      nearAny = true
    }
  }
  explorePrompt.style.display = nearAny ? 'block' : 'none'

  if (exploreMsgTimer > 0) {
    exploreMsgTimer -= delta
    if (exploreMsgTimer <= 0) exploreMsg.style.display = 'none'
  }
}

let lastTime = 0

function animate(timestamp) {
  requestAnimationFrame(animate)
  const delta = (timestamp - lastTime) / 1000
  lastTime = timestamp

  // Title screen: pause everything until a mode is chosen
  if (onTitle) {
    renderer.render(scene, camera)
    return
  }

  // Exploration mode runs its own update loop, independent of the fight
  if (gameMode === 'explore') {
    updateExplore(delta)
    renderer.render(scene, camera)
    return
  }

  if (gameOver) {
    renderer.render(scene, camera)
    return
  }

  // Between rounds: hold the ROUND X COMPLETE message, then start the next round
  if (roundTransition) {
    roundTransitionTimer -= delta
    if (roundTransitionTimer <= 0) {
      startNextRound()
    }
    renderer.render(scene, camera)
    return
  }

  // Dragon Pulse: update BEFORE the hitstop check so it keeps moving during hitstop
  if (dragonPulse) {
    dragonPulse.position.x += PULSE_SPEED * pulseDirection
    console.log('Dragon Pulse x:', dragonPulse.position.x.toFixed(3))
    if (Math.abs(dragonPulse.position.x - pulseStartX) > 1.5 && Math.abs(dragonPulse.position.x - opponent.position.x) < PULSE_HIT_RANGE) {
      console.log('Dragon Pulse hit opponent at x:', dragonPulse.position.x.toFixed(3))
      scene.remove(dragonPulse)
      dragonPulse = null
      opponentHealth = Math.max(0, opponentHealth - PULSE_DAMAGE * damageBoost())
      updateHealthBars()
      opponent.material.color.setHex(0xffffff)
      opponentFlashTimer = 0.1
      knockDownOpponent()
      if (opponentHealth <= 0) {
        showWinner('IRON DRAGON WINS!')
      }
    } else if (Math.abs(dragonPulse.position.x) >= PULSE_REMOVE_X) {
      console.log('Dragon Pulse removed at x:', dragonPulse.position.x.toFixed(3))
      scene.remove(dragonPulse)
      dragonPulse = null
    }
  }

  if (hitstopTimer > 0) {
    hitstopTimer -= delta
    renderer.render(scene, camera)
    return
  }

  if (keys['KeyA']) ironDragon.position.x -= 0.05
  if (keys['KeyD']) ironDragon.position.x += 0.05
  if (keys['ArrowLeft']) opponent.position.x -= 0.05
  if (keys['ArrowRight']) opponent.position.x += 0.05

  // Bagua dash: smoothly slide toward the side of the opponent, then snap and stop
  if (baguaDashing) {
    ironDragon.position.x += (baguaTargetX - ironDragon.position.x) * 0.3
    if (Math.abs(baguaTargetX - ironDragon.position.x) <= 0.1) {
      ironDragon.position.x = baguaTargetX
      baguaDashing = false
    }
  }

  ironDragon.position.x = Math.max(-7, Math.min(7, ironDragon.position.x))
  opponent.position.x = Math.max(-7, Math.min(7, opponent.position.x))

  if (ironDragonAttacking) {
    attackTimer += delta
    if (!attackHit) {
      const distance = Math.abs(ironDragon.position.x - opponent.position.x)
      if (distance < ATTACK_RANGE) {
        attackHit = true
        playHitSound()
        const attackDamage = (baguaBuffTimer > 0 ? J_DAMAGE * BAGUA_DAMAGE_MULT : J_DAMAGE) * damageBoost()
        opponentHealth = Math.max(0, opponentHealth - attackDamage)
        updateHealthBars()
        chi = Math.min(CHI_MAX, chi + CHI_PER_HIT)
        updateChiBar()
        hitstopTimer = HITSTOP_DURATION
        const direction = opponent.position.x > ironDragon.position.x ? 1 : -1
        opponent.position.x += direction * 0.5
        opponent.material.color.setHex(0xffffff)
        opponentFlashTimer = 0.1
        camera.position.x += (Math.random() - 0.5) * 0.3
        camera.position.y += (Math.random() - 0.5) * 0.3
        if (opponentHealth <= 0) {
          showWinner('IRON DRAGON WINS!')
        }
      }
    }
    if (attackTimer >= ATTACK_DURATION) {
      ironDragonAttacking = false
      ironDragon.material.color.setHex(ironDragonBaseColor())
    }
  }

  // Vampire Lieutenant AI: wait AI_START_DELAY, then move toward Iron Dragon and attack
  roundTimer += delta
  const aiActive = roundTimer >= AI_START_DELAY
  const aiDistance = Math.abs(opponent.position.x - ironDragon.position.x)
  if (aiActive && aiDistance > AI_MIN_DISTANCE) {
    const aiDirection = ironDragon.position.x < opponent.position.x ? -1 : 1
    opponent.position.x += aiDirection * OPPONENT_SPEED
    opponent.position.x = Math.max(-7, Math.min(7, opponent.position.x))
  }
  if (aiActive) {
    opponent.position.x += Math.random() * 0.01 - 0.005
    opponent.position.x = Math.max(-7, Math.min(7, opponent.position.x))
  }

  // Vampire speed: blink 1 unit closer to Iron Dragon every VAMPIRE_TELEPORT_INTERVAL seconds
  if (aiActive) {
    vampireTeleportTimer += delta
    if (vampireTeleportTimer >= VAMPIRE_TELEPORT_INTERVAL) {
      vampireTeleportTimer = 0
      const blinkDir = ironDragon.position.x < opponent.position.x ? -1 : 1
      const blinkX = opponent.position.x + blinkDir * 1
      // Don't blink past Iron Dragon or inside the minimum stance distance
      if (Math.abs(blinkX - ironDragon.position.x) >= AI_MIN_DISTANCE) {
        opponent.position.x = Math.max(-7, Math.min(7, blinkX))
      }
      // Red flash to telegraph the vampire-speed power
      opponent.material.color.setHex(0xff0000)
      opponentFlashTimer = 0.2
    }
  }

  opponentAttackTimer += delta
  if (aiActive && opponentAttackTimer >= OPPONENT_ATTACK_INTERVAL && aiDistance < OPPONENT_ATTACK_RANGE) {
    opponentAttackTimer = 0
    // An incoming attack breaks meditation and stops healing
    idleTimer = 0
    // Iron Shirt absorbs the hit completely: no damage, no knockback
    if (!ironShirtActive) {
      ironDragonHealth = Math.max(0, ironDragonHealth - OPPONENT_DAMAGE)
      lastDamageTaken = OPPONENT_DAMAGE
      redirectWindow = REDIRECT_WINDOW_DURATION
      updateHealthBars()
    }
    hitstopTimer = HITSTOP_DURATION

    // Flash orange when attacking
    opponent.material.color.setHex(0xff8800)
    opponentFlashTimer = 0.15

    // Knock Iron Dragon back, flash it, shake camera
    if (!ironShirtActive) {
      const knockDir = ironDragon.position.x < opponent.position.x ? -1 : 1
      ironDragon.position.x += knockDir * 0.5
      ironDragon.position.x = Math.max(-7, Math.min(7, ironDragon.position.x))
      ironDragon.material.color.setHex(0xffffff)
      ironDragonFlashTimer = 0.1
    }
    camera.position.x += (Math.random() - 0.5) * 0.3
    camera.position.y += (Math.random() - 0.5) * 0.3

    if (ironDragonHealth <= 0) {
      showWinner('VAMPIRE LIEUTENANT WINS')
    }
  }

  camera.position.x += (0 - camera.position.x) * 0.2
  camera.position.y += (2 - camera.position.y) * 0.2

  if (redirectWindow > 0) {
    redirectWindow -= delta
  }

  if (redirectTextTimer > 0) {
    redirectTextTimer -= delta
    if (redirectTextTimer <= 0) {
      redirectText.style.display = 'none'
    }
  }

  if (wardOffTimer > 0) {
    wardOffTimer -= delta
    if (wardOffTimer <= 0) {
      opponent.rotation.z = 0
    }
  }

  if (wardOffTextTimer > 0) {
    wardOffTextTimer -= delta
    if (wardOffTextTimer <= 0) {
      wardOffText.style.display = 'none'
    }
  }

  if (pushCooldown > 0) {
    pushCooldown -= delta
  }

  if (rollbackTextTimer > 0) {
    rollbackTextTimer -= delta
    if (rollbackTextTimer <= 0) {
      rollbackText.style.display = 'none'
    }
  }

  if (pressCooldown > 0) {
    pressCooldown -= delta
  }

  if (pressTextTimer > 0) {
    pressTextTimer -= delta
    if (pressTextTimer <= 0) {
      pressText.style.display = 'none'
    }
  }

  if (ironShirtActive) {
    ironShirtTimer -= delta
    if (ironShirtTimer <= 0) {
      ironShirtActive = false
      ironShirtText.style.display = 'none'
      // Drop the grey metallic look back to the resting color
      if (!ironDragonAttacking && ironDragonFlashTimer <= 0) {
        ironDragon.material.color.setHex(ironDragonBaseColor())
      }
    }
  }

  if (baguaBuffTimer > 0) {
    baguaBuffTimer -= delta
    // Once the advantage ends, drop the orange glow back to the resting color
    if (baguaBuffTimer <= 0 && !ironDragonAttacking && ironDragonFlashTimer <= 0) {
      ironDragon.material.color.setHex(ironDragonBaseColor())
    }
  }

  if (ironDragonFlashTimer > 0) {
    ironDragonFlashTimer -= delta
    if (ironDragonFlashTimer <= 0 && !ironDragonAttacking) {
      ironDragon.material.color.setHex(ironDragonBaseColor())
    }
  }

  if (opponentFlashTimer > 0) {
    opponentFlashTimer -= delta
    if (opponentFlashTimer <= 0) {
      opponent.material.color.setHex(0xff2200)
    }
  }

  // After falling, the opponent stands back upright
  if (opponentFallTimer > 0) {
    opponentFallTimer -= delta
    if (opponentFallTimer <= 0) {
      opponent.rotation.z = 0
    }
  }

  // Chi stages: announce stage changes and keep Iron Dragon's resting color in sync with Chi
  const newChiStage = getChiStage()
  if (newChiStage !== chiStage) {
    if (newChiStage > chiStage) playChiChargeSound()
    chiStage = newChiStage
    const hex = '#' + CHI_STAGE_COLORS[chiStage - 1].toString(16).padStart(6, '0')
    chiStageText.textContent = 'CHI STAGE ' + chiStage
    chiStageText.style.color = hex
    chiStageText.style.textShadow = '0 0 20px ' + hex
    chiStageText.style.display = 'block'
    chiStageTextTimer = 1
  }
  if (chiStageTextTimer > 0) {
    chiStageTextTimer -= delta
    if (chiStageTextTimer <= 0) {
      chiStageText.style.display = 'none'
    }
  }
  // Live color update so the stage color shows as Chi changes (skip while flashing or attacking)
  if (ironDragonFlashTimer <= 0 && !ironDragonAttacking) {
    ironDragon.material.color.setHex(ironDragonBaseColor())
  }

  // Iron Qigong meditation: heal after standing idle, stopping instantly on input or attack
  const anyKeyDown = Object.values(keys).some(Boolean)
  if (anyKeyDown || gameOver) {
    idleTimer = 0
  } else {
    idleTimer += delta
  }
  isHealing = !gameOver && idleTimer >= QIGONG_DELAY
  if (isHealing && ironDragonHealth < 100) {
    ironDragonHealth = Math.min(100, ironDragonHealth + QIGONG_HEAL_RATE * delta)
    updateHealthBars()
  }
  // Show HEALING while actively regenerating health
  healingText.style.display = isHealing && ironDragonHealth < 100 ? 'block' : 'none'
  // Subtle white pulse while meditating (skip if another state already owns the color)
  const canPulse = isHealing && !ironDragonAttacking && ironDragonFlashTimer <= 0 && !ironShirtActive && baguaBuffTimer <= 0
  if (canPulse) {
    const pulse = (Math.sin(timestamp / 200) + 1) / 2
    ironDragon.material.color.copy(new THREE.Color(ironDragonBaseColor())).lerp(new THREE.Color(0xffffff), pulse * 0.4)
    qigongPulsing = true
  } else if (qigongPulsing) {
    qigongPulsing = false
    ironDragon.material.color.setHex(ironDragonBaseColor())
  }

  renderer.render(scene, camera)
}

animate(0)
console.log('Iron Dragon running')
