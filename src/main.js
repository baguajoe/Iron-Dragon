import * as THREE from 'three'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x111111)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 2, 8)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

// Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 5),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.4))
const sun = new THREE.DirectionalLight(0xffffff, 1.2)
sun.position.set(5, 10, 5)
sun.castShadow = true
scene.add(sun)

// Iron Dragon — green box placeholder
const ironDragon = new THREE.Mesh(
  new THREE.BoxGeometry(1, 2, 1),
  new THREE.MeshStandardMaterial({ color: 0x00ff88 })
)
ironDragon.position.set(-2, 1, 0)
ironDragon.castShadow = true
scene.add(ironDragon)

// Opponent — red box placeholder
const opponent = new THREE.Mesh(
  new THREE.BoxGeometry(1, 2, 1),
  new THREE.MeshStandardMaterial({ color: 0xff2200 })
)
opponent.position.set(2, 1, 0)
opponent.castShadow = true
scene.add(opponent)

// Input
const keys = {}
window.addEventListener('keydown', e => keys[e.code] = true)
window.addEventListener('keyup', e => keys[e.code] = false)

// Game loop
function animate() {
  requestAnimationFrame(animate)

  // Player 1 - Iron Dragon (A/D to move)
  if (keys['KeyA']) ironDragon.position.x -= 0.05
  if (keys['KeyD']) ironDragon.position.x += 0.05

  // Player 2 - Opponent (Arrow keys to move)
  if (keys['ArrowLeft']) opponent.position.x -= 0.05
  if (keys['ArrowRight']) opponent.position.x += 0.05

  renderer.render(scene, camera)
}

animate()
console.log('Iron Dragon running')
