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
const roundText = document.getElementById('roundtext')

const winScreen = document.createElement('div')
winScreen.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#00ff88;font-family:Arial;font-size:52px;font-weight:bold;z-index:9999;display:none;text-shadow:0 0 20px #00ff88;text-align:center;"
document.body.appendChild(winScreen)

const controls = document.createElement('div')
controls.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);color:#666;font-family:Arial;font-size:12px;z-index:999;text-align:center;"
controls.innerHTML = "A/D = Move Iron Dragon &nbsp;|&nbsp; Arrow Keys = Move Opponent &nbsp;|&nbsp; J = Attack"
document.body.appendChild(controls)

window.addEventListener('keydown', e => {
  if (e.code === 'KeyJ' && !ironDragonAttacking && !gameOver) {
    ironDragonAttacking = true
    attackTimer = 0
    attackHit = false
    ironDragon.material.color.setHex(0xffff00)
  }
})

function updateHealthBars() {
  p1Fill.style.width = Math.max(0, ironDragonHealth) + '%'
  p2Fill.style.width = Math.max(0, opponentHealth) + '%'
}

function showWinner(text) {
  gameOver = true
  winScreen.style.display = 'block'
  winScreen.innerHTML = text + '<br><span style="font-size:18px;color:white;">Press R to restart</span>'
}

window.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && gameOver) {
    ironDragonHealth = 100
    opponentHealth = 100
    gameOver = false
    winScreen.style.display = 'none'
    roundText.textContent = 'ROUND 1'
    ironDragon.position.set(-2, 1, 0)
    opponent.position.set(2, 1, 0)
    ironDragon.material.color.setHex(0x00ff88)
    opponent.material.color.setHex(0xff2200)
    updateHealthBars()
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
        opponentHealth = Math.max(0, opponentHealth - 15)
        updateHealthBars()
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
      ironDragon.material.color.setHex(0x00ff88)
    }
  }

  camera.position.x += (0 - camera.position.x) * 0.2
  camera.position.y += (2 - camera.position.y) * 0.2

  if (opponentFlashTimer > 0) {
    opponentFlashTimer -= delta
    if (opponentFlashTimer <= 0) {
      opponent.material.color.setHex(0xff2200)
    }
  }

  renderer.render(scene, camera)
}

animate(0)
console.log('Iron Dragon running')
