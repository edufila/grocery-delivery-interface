#!/usr/bin/env node
/**
 * ¿Se puede trabajar aquí ahora mismo, o hay que traer algo primero?
 *
 *   node scripts/al-dia.mjs
 *
 * Existe porque somos cuatro tocando el mismo repo -- dos hermanos y el Claude
 * de cada uno -- y cada uno arranca sin saber qué hizo el otro hace media hora.
 * La regla "haz git pull antes de tocar nada" ya estaba escrita en CLAUDE.md y
 * aun así se olvida, porque leer una regla y acordarse de ella en el momento
 * son dos cosas distintas.
 *
 * Así que en vez de una regla, un comando que responde con un sí o un no.
 *
 * Lo peligroso no es olvidar el pull: es lo que uno hace DESPUÉS de olvidarlo.
 * Se trabaja media hora sobre una copia vieja, el push rebota, y de ahí salen
 * el `--force` y el `reset --hard` que borran el trabajo del otro. Esto corta
 * la cadena en el primer eslabón, que es el único barato.
 *
 * Sale con código 1 si no se puede trabajar, para que sirva de portón.
 */
import { execSync } from "node:child_process"

const V = "\x1b[32m"
const R = "\x1b[31m"
const A = "\x1b[33m"
const G = "\x1b[90m"
const X = "\x1b[0m"

/** Devuelve la salida, o null si el comando falla. No lanza. */
function git(orden) {
  try {
    return execSync(`git ${orden}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  } catch {
    return null
  }
}

console.log("")

// ------------------------------------------------------------------ ¿es un repo?

if (git("rev-parse --git-dir") === null) {
  console.log(`${R}Esta carpeta no es un repositorio de git.${X}`)
  console.log("")
  console.log("Casi seguro es una copia bajada como ZIP desde GitHub. Un ZIP es una")
  console.log("foto de un momento: no sabe qué cambió después, no puede traer lo")
  console.log("nuevo, y si su contenido termina subido pisa lo que hicieron los")
  console.log("demás. Es la forma más silenciosa de perder trabajo ajeno.")
  console.log("")
  console.log("Lo que hay que hacer, en una carpeta nueva:")
  console.log("")
  console.log("  git clone https://github.com/edufila/grocery-delivery-interface.git")
  console.log("")
  console.log("Y trabajar ahí. Si en esta carpeta hay cambios que valen, se copian")
  console.log("a mano archivo por archivo mirando qué se pisa.")
  console.log("")
  process.exit(1)
}

// ------------------------------------------------------------------ ¿y el remoto?

if (!git("remote get-url origin")) {
  console.log(`${R}No hay remoto configurado.${X} Este repo no habla con GitHub,`)
  console.log("así que nadie más va a ver lo que se haga aquí.")
  console.log("")
  process.exit(1)
}

console.log(`${G}Consultando GitHub...${X}`)

if (git("fetch --quiet") === null) {
  console.log("")
  console.log(`${A}No se pudo consultar GitHub.${X} Puede ser falta de señal.`)
  console.log("Sin saber qué hay allá, cualquier cosa que se escriba aquí es a")
  console.log("ciegas. Mejor esperar a tener conexión.")
  console.log("")
  process.exit(1)
}

const rama = git("rev-parse --abbrev-ref HEAD")
const detras = Number(git("rev-list --count HEAD..@{u}") ?? 0)
const adelante = Number(git("rev-list --count @{u}..HEAD") ?? 0)
const sucio = (git("status --porcelain") ?? "").split("\n").filter(Boolean)

console.log("")
console.log(`  rama         ${rama}`)
console.log(`  sin traer    ${detras}`)
console.log(`  sin subir    ${adelante}`)
console.log(`  sin guardar  ${sucio.length} ${sucio.length === 1 ? "archivo" : "archivos"}`)
console.log("")

// -------------------------------------------------- las dos historias se separaron

if (detras > 0 && adelante > 0) {
  console.log(`${R}Las dos copias se separaron.${X} Hay ${adelante} sin subir y ${detras} sin traer.`)
  console.log("")
  console.log("Alguien más trabajó mientras tú trabajabas. No es un problema, es")
  console.log("lo normal cuando son varios. Se junta así:")
  console.log("")
  if (sucio.length > 0) console.log('  git add -A && git commit -m "lo que hiciste"')
  console.log("  git pull --rebase")
  console.log("  git push")
  console.log("")
  console.log(`${R}Lo que NO se hace aquí, nunca:${X}`)
  console.log("")
  console.log("  git push --force     borra del servidor lo que hizo el otro")
  console.log("  git reset --hard     borra lo tuyo sin preguntar")
  console.log("  git checkout .       lo mismo, en silencio")
  console.log("")
  console.log("Si el rebase se traba, para y pregunta. Trabarse cuesta minutos;")
  console.log("forzar cuesta el trabajo de alguien.")
  console.log("")
  process.exit(1)
}

// ------------------------------------------------------------------ falta traer

if (detras > 0) {
  console.log(
    `${R}Estás desactualizado.${X} Hay ${detras} ${detras === 1 ? "cambio" : "cambios"} en GitHub que no tienes.`,
  )
  console.log("")
  console.log(git("log --oneline HEAD..@{u} --max-count=8") ?? "")
  console.log("")
  console.log(sucio.length > 0 ? "  git stash && git pull && git stash pop" : "  git pull")
  console.log("")
  console.log("No edites nada antes de eso. Editar sobre una copia vieja es como")
  console.log("terminan las dos copias separadas y los push forzados.")
  console.log("")
  process.exit(1)
}

// ----------------------------------------------------------------- todo en orden

console.log(`${V}Al día con GitHub.${X} Se puede trabajar.`)
console.log("")

if (adelante > 0) {
  console.log(`  ${A}Tienes ${adelante} sin subir.${X} Súbelos cuando termines: git push`)
}

if (sucio.length > 0) {
  console.log(`  ${A}Tienes ${sucio.length} sin guardar:${X}`)
  for (const linea of sucio.slice(0, 10)) console.log(`     ${linea}`)
  if (sucio.length > 10) console.log(`     ... y ${sucio.length - 10} más`)
  console.log("")
  console.log("  Si no son tuyos, no los borres: pregunta antes.")
}

console.log("")
