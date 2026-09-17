// O código do app é escrito para o Vite, que resolve `./x` como `./x.js`.
// O Node não faz isso. Este gancho ensina o Node a mesma regra, para que os
// scripts de conferência possam importar os módulos REAIS do app em vez de
// copiar a lógica (cópia diverge; importar o original não).
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(especificador, contexto, proximo) {
    if (especificador.startsWith('.') && !/\.[a-z]+$/i.test(especificador)) {
      for (const ext of ['.js', '.jsx', '/index.js']) {
        const tentativa = new URL(especificador + ext, contexto.parentURL)
        if (existsSync(fileURLToPath(tentativa))) return proximo(especificador + ext, contexto)
      }
    }
    return proximo(especificador, contexto)
  },
})
