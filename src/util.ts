/* eslint-disable @typescript-eslint/no-explicit-any */

export const getRandomId = (n = 8) =>
  Array(n)
    .fill(0)
    .map(() => ((16 * Math.random()) | 0).toString(16))
    .join('')

export const debounce = (fn: (a?: any, b?: any, c?: any, d?: any) => void, ms: number) => {
  let timeout: number

  return function debounceWrap(this: any, a?: any, b?: any, c?: any, d?: any) {
    clearTimeout(timeout)
    timeout = setTimeout(fn.bind(this, a, b, c, d), ms) as unknown as number
    return timeout
  }
}

export const ask = (title: string | null, text: string | null, defaultValue = '') => {
  return new Promise(resolve => {
    const div = document.createElement('div')
    div.className = 'prompt'
    div.innerHTML = `
      <div class="inner">
        <div class="title"></div>
        <div class="text"></div>
        <input type="text">
        <div class="buttons">
          <button class="cancel">Cancel</button> <button class="ok">OK</button>
        </div>
      </div>
    `
    div.querySelector('.title')!.textContent = title
    div.querySelector('.text')!.textContent = text
    div.querySelector('input')!.value = defaultValue

    const keyListener = (e: { stopPropagation: () => void; which: number }) => {
      e.stopPropagation()
      if (e.which === 13) ok()
      if (e.which === 27) cancel()
    }

    const prevent = (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
    }

    const preventEvents = ['keyup', 'input', 'keypress', 'mousedown', 'mouseup', 'mousemove', 'mousewheel']

    const cleanup = () => {
      window.removeEventListener('keydown', keyListener, { capture: true })
      preventEvents.forEach(event => {
        window.removeEventListener(event, prevent, { capture: true })
      })
      document.body.removeChild(div)
    }

    const ok = () => {
      cleanup()
      resolve({ value: div.querySelector('input')!.value })
    }

    const cancel = () => {
      cleanup()
      resolve(false)
    }

    ;(div.querySelector('.ok')! as HTMLButtonElement).onclick = ok
    ;(div.querySelector('.cancel')! as HTMLButtonElement).onclick = cancel

    window.addEventListener('keydown', keyListener, { capture: true })
    preventEvents.forEach(event => {
      window.addEventListener(event, prevent, { capture: true })
    })

    document.body.appendChild(div)

    div.querySelector('input')!.focus()
    div.querySelector('input')!.select()
  })
}
