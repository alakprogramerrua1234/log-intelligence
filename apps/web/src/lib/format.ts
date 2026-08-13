// Formateo de números estable entre servidor y cliente.
//
// `value.toLocaleString()` sin argumentos usa el locale del ENTORNO, y ese
// entorno no es el mismo en SSR que en el navegador:
//
//   Node (SSR)      -> en-US -> "1,240"
//   navegador es/it -> es/it -> "1240"   (4 dígitos no llevan separador)
//   navegador de-DE -> de-DE -> "1.240"
//
// React compara el HTML del servidor con el del cliente y lo detecta como
// hydration mismatch, así que descarta el árbol y lo regenera en cliente.
//
// Fijar el locale elimina la variable. Va a "en-US" porque toda la UI está en
// inglés; el día que haya i18n, este es el único punto que hay que tocar.

const COUNT_FORMAT = new Intl.NumberFormat("en-US")

/** Formatea un contador (logs, técnicas, fuentes) de forma determinista. */
export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value)
}
