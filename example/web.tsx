/** @jsxImportSource sigl */
import $ from 'sigl'

import { CanvyElement, EditorScene, File } from '../src'

const scene = new EditorScene(document.body)

const Canvy = $.element(CanvyElement)

const canvy = {
  current: null as null | CanvyElement,
}

$.render(
  <Canvy
    ref={canvy}
    scene={scene}
    files={[
      new File({
        value: `\\ hello

\\ world

f()=sin(330);
`,
      }),
    ]}
  />,
  document.body
)

queueMicrotask(() => {
  canvy.current!.$.effect(({ worker }) => {
    worker.postMessage({
      call: 'onmarkers',
      markers: [
        { index: 4, size: 4 },
        { index: 10, size: 3 },
      ],
    })
  })
})
