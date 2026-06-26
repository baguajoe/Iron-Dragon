import * as THREE from 'three'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x111111)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 2, 8)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 5),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

scene.add(new THREE.AmbientLight(0xffffff, 0.4))
const sun = new THREE.DirectionalLight(0xffffff, 1.2)
sun.position.set(5, 10, 5)
sun.castShadow = true
scene.add(sun)

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
window.addEventListener('keydown', e => { keys[e.code] = true })
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

let opponentAttackTimer = 0
const OPPONENT_ATTACK_INTERVAL = 3
const OPPONENT_ATTACK_RANGE = 2.5
const OPPONENT_DAMAGE = 10
const OPPONENT_SPEED = 0.02
let ironDragonFlashTimer = 0
let roundTimer = 0
const AI_START_DELAY = 2

let chi = 0
const CHI_MAX = 100
const CHI_PER_HIT = 12
const CHI_PULSE_THRESHOLD = 50
const CHI_PULSE_COST = 50
const PULSE_SPEED = 0.08
const PULSE_REMOVE_X = 8
const PULSE_DAMAGE = 35
const PULSE_HIT_RANGE = 1.2
let dragonPulse = null

const J_DAMAGE = 15
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

// Iron Dragon glows white at full Chi; otherwise its normal green.
function ironDragonBaseColor() {
  return chi >= CHI_MAX ? 0xffffff : 0x00ff88
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
    </div>
    <div style="width:35%;text-align:right;">
      <div style="color:#ff2200;font-weight:bold;font-size:13px;margin-bottom:4px;">OPPONENT</div>
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

const winScreen = document.createElement('div')
winScreen.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#00ff88;font-family:Arial;font-size:52px;font-weight:bold;z-index:9999;display:none;text-shadow:0 0 20px #00ff88;text-align:center;"
document.body.appendChild(winScreen)

const controls = document.createElement('div')
controls.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);color:#666;font-family:Arial;font-size:12px;z-index:999;text-align:center;"
controls.innerHTML = "A/D = Move Iron Dragon &nbsp;|&nbsp; Arrow Keys = Move Opponent &nbsp;|&nbsp; J = Attack &nbsp;|&nbsp; K = Dragon Pulse (50 Chi)"
document.body.appendChild(controls)

window.addEventListener('keydown', e => {
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
    updateChiBar()
    dragonPulse = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    )
    dragonPulse.position.set(ironDragon.position.x + 2, 1, ironDragon.position.z)
    scene.add(dragonPulse)
    console.log('Dragon Pulse created at x:', dragonPulse.position.x)
    // Drop out of full-power white once Chi falls below max (unless mid-attack/flash)
    if (!ironDragonAttacking && ironDragonFlashTimer <= 0) {
      ironDragon.material.color.setHex(ironDragonBaseColor())
    }
  }
})

function updateHealthBars() {
  p1Fill.style.width = Math.max(0, ironDragonHealth) + '%'
  p2Fill.style.width = Math.max(0, opponentHealth) + '%'
}

function updateChiBar() {
  chiFill.style.width = Math.max(0, Math.min(CHI_MAX, chi)) + '%'
}

function showWinner(text) {
  gameOver = true
  const color = text.startsWith('VAMPIRE LORD') ? '#ff2200' : '#00ff88'
  winScreen.style.color = color
  winScreen.style.textShadow = '0 0 20px ' + color
  winScreen.style.display = 'block'
  winScreen.innerHTML = text + '<br><span style="font-size:18px;color:white;">Press R to restart</span>'
}

window.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && gameOver) {
    ironDragonHealth = 100
    opponentHealth = 100
    gameOver = false
    opponentAttackTimer = 0
    ironDragonFlashTimer = 0
    roundTimer = 0
    chi = 0
    if (dragonPulse) {
      scene.remove(dragonPulse)
      dragonPulse = null
    }
    opponentFallTimer = 0
    opponent.rotation.z = 0
    winScreen.style.display = 'none'
    roundText.textContent = 'ROUND 1'
    ironDragon.position.set(-2, 1, 0)
    opponent.position.set(2, 1, 0)
    ironDragon.material.color.setHex(0x00ff88)
    opponent.material.color.setHex(0xff2200)
    updateHealthBars()
    updateChiBar()
  }
})

let lastTime = 0

function animate(timestamp) {
  requestAnimationFrame(animate)
  const delta = (timestamp - lastTime) / 1000
  lastTime = timestamp

  if (gameOver) {
    renderer.render(scene, camera)
    return
  }

  // Dragon Pulse: update BEFORE the hitstop check so it keeps moving during hitstop
  if (dragonPulse) {
    dragonPulse.position.x += PULSE_SPEED
    console.log('Dragon Pulse x:', dragonPulse.position.x.toFixed(3))
    if (Math.abs(dragonPulse.position.x - opponent.position.x) < PULSE_HIT_RANGE) {
      console.log('Dragon Pulse hit opponent at x:', dragonPulse.position.x.toFixed(3))
      scene.remove(dragonPulse)
      dragonPulse = null
      opponentHealth = Math.max(0, opponentHealth - PULSE_DAMAGE)
      updateHealthBars()
      opponent.material.color.setHex(0xffffff)
      opponentFlashTimer = 0.1
      knockDownOpponent()
      if (opponentHealth <= 0) {
        showWinner('IRON DRAGON WINS!')
      }
    } else if (dragonPulse.position.x >= PULSE_REMOVE_X) {
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

  ironDragon.position.x = Math.max(-7, Math.min(7, ironDragon.position.x))
  opponent.position.x = Math.max(-7, Math.min(7, opponent.position.x))

  if (ironDragonAttacking) {
    attackTimer += delta
    if (!attackHit) {
      const distance = Math.abs(ironDragon.position.x - opponent.position.x)
      if (distance < ATTACK_RANGE) {
        attackHit = true
        opponentHealth = Math.max(0, opponentHealth - J_DAMAGE)
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

  // Vampire Lord AI: wait AI_START_DELAY, then move toward Iron Dragon and attack
  roundTimer += delta
  const aiActive = roundTimer >= AI_START_DELAY
  const aiDistance = Math.abs(opponent.position.x - ironDragon.position.x)
  if (aiActive && aiDistance > OPPONENT_ATTACK_RANGE - 0.5) {
    const aiDirection = ironDragon.position.x < opponent.position.x ? -1 : 1
    opponent.position.x += aiDirection * OPPONENT_SPEED
    opponent.position.x = Math.max(-7, Math.min(7, opponent.position.x))
  }

  opponentAttackTimer += delta
  if (aiActive && opponentAttackTimer >= OPPONENT_ATTACK_INTERVAL && aiDistance < OPPONENT_ATTACK_RANGE) {
    opponentAttackTimer = 0
    ironDragonHealth = Math.max(0, ironDragonHealth - OPPONENT_DAMAGE)
    updateHealthBars()
    hitstopTimer = HITSTOP_DURATION

    // Flash orange when attacking
    opponent.material.color.setHex(0xff8800)
    opponentFlashTimer = 0.15

    // Knock Iron Dragon back, flash it, shake camera
    const knockDir = ironDragon.position.x < opponent.position.x ? -1 : 1
    ironDragon.position.x += knockDir * 0.5
    ironDragon.position.x = Math.max(-7, Math.min(7, ironDragon.position.x))
    ironDragon.material.color.setHex(0xffffff)
    ironDragonFlashTimer = 0.1
    camera.position.x += (Math.random() - 0.5) * 0.3
    camera.position.y += (Math.random() - 0.5) * 0.3

    if (ironDragonHealth <= 0) {
      showWinner('VAMPIRE LORD WINS')
    }
  }

  camera.position.x += (0 - camera.position.x) * 0.2
  camera.position.y += (2 - camera.position.y) * 0.2

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


  renderer.render(scene, camera)
}

animate(0)
console.log('Iron Dragon running')
