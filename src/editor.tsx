/** @jsxImportSource sigl */
import $ from 'sigl'

export interface Lens {
  line: number
  message: string
}

export interface Marker {
  key: string
  index: number
  size: number
  kind: 'param' | 'error'
  color: string
  hoverColor: string
  message: string
}

// import { Matrix, Point, Rect } from 'sigl'
// import { getElementOffset } from 'get-element-offset'

import { cheapRandomId } from 'everyday-utils'
import { EditorScene } from './editor-scene'
import { Editor } from './editor-worker'

// const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)

// let selectionText = ''
// let textarea: HTMLTextAreaElement | null

export const Editors = new Set()

export class File {
  id: string
  title: string
  value?: string
  canvy!: CanvyElement
  previousId: string

  constructor(data: Partial<File> = {}) {
    this.id = data.id ?? cheapRandomId()
    this.title = data.title ?? 'untitled'
    this.value = data.value ?? ''
    this.previousId = this.id // TODO: HACK
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      value: this.value,
    }
  }

  updateMeta() {
    this.setData({
      id: this.id,
      title: this.title,
    })
  }

  focus() {
    this.canvy.editor.setFocusedEditorById({ id: this.id })
  }

  setColor(color: string) {
    this.canvy.editor.setColor({ color })
  }

  setData(data: { id: string; title: string }) {
    this.canvy.editor.setEditorData({
      id: this.previousId,
      data,
    })
    this.previousId = this.id
  }

  rename(newTitle: string) {
    this.title = newTitle
    this.updateMeta()
  }

  delete() {
    this.canvy.files.splice(this.canvy.files.indexOf(this), 1)
    this.canvy.editor.deleteEditor({
      id: this.id,
    })
    if (!this.canvy.files.length) {
      // const file = new File(this.editor)
      // this.editor.files.push(file)
      // this.setData(file.toJSON())
      // this.editor.oncreate?.(file)
    }
  }

  moveUp() {
    const index = this.canvy.files.indexOf(this)
    if (index >= 1) {
      this.canvy.editor.moveEditorUp({
        id: this.id,
      })
      const self = this.canvy.files[index]
      const other = this.canvy.files[index - 1]
      this.canvy.files.splice(index - 1, 2, self, other)
      return [self, other]
    }
  }

  moveDown() {
    const index = this.canvy.files.indexOf(this)
    if (index < this.canvy.files.length - 1) {
      this.canvy.editor.moveEditorDown({
        id: this.id,
      })
      const self = this.canvy.files[index]
      const other = this.canvy.files[index + 1]
      this.canvy.files.splice(index, 2, other, self)
      return [other, self]
    }
  }
}

export interface CanvyEvents {
  entermarker: CustomEvent<{ marker: Marker, markerIndex: number }>
  leavemarker: CustomEvent<{ marker: Marker, markerIndex: number }>
  event: CustomEvent<{ name: string; data: any }>
  edit: CustomEvent
}

export interface CanvyElement extends $.Element<CanvyElement, CanvyEvents> { }

@$.element()
export class CanvyElement extends $.mix(HTMLElement, $.mixins.layout()) {
  @$.out() fontSize = 11
  @$.attr() focused = false

  initialValue?: string

  singleComment = '//'

  caret: any
  scene?: EditorScene

  editor!: Editor

  pixelRatio = window.devicePixelRatio
  isVisible = true

  get value() {
    return this.files[0]?.value
  }

  // rect?: $.Rect

  // size?: $.Point = $(this).reduce(
  //   ({ $, rect }) => $.size?.equals(rect.size) ? $.size : rect.size
  // )

  // pos: $.Point = $(this).reduce(
  //   ({ $, rect }) => $.pos?.equals(rect.pos) ? $.pos : rect.pos,
  //   new $.Point()
  // )

  @$.out() files: File[] = []
  focusedFile = $(this).reduce.once(({ files }) => files[0])

  @$.attr() ready = false

  canvas?: HTMLCanvasElement
  font?: string

  setCaret({ caret }: any) {
    this.caret = caret
  }
  _onready() {
    this.ready = true
  }
  _ondraw() {
  }

  _onblur = $(this).reduce(({ $, editor }) =>
    () => {
      $.focused = false
      $.hoveringMarkerIndex = null
      editor.onblur()
    }
  )

  _onfocus = $(this).reduce(({ $, files }) =>
    ({ id }: { id: string }) => {
      $.focused = true
      const file = files.find(file => file.id === id)
      if (!file) return

      $.focusedFile = file
      // console.log('focus', $.focusedFile)
      // $.on(window).pointerdown.once(() => {

      // })
    }
  )

  _onresize = $(this).reduce(({ canvas, pixelRatio }) => ({ width, height }: any) => {
    canvas.style.width = (width / pixelRatio) + 'px'
    canvas.style.height = (height / pixelRatio) + 'px'
  })

  _onselection = $(this).reduce(({ scene }) =>
    ({ text }: { text: string }) => {
      // const { textarea } = scene
      // if (textarea) {
      //   if (text.length) {
      //     textarea.select()
      //   } else {
      //     textarea.selectionStart = -1
      //     textarea.selectionEnd = -1
      //   }
      // }
      scene.selectionText = text
      // this.onselection?.(text)
    }
  )

  _onedit = $(this).reduce(({ host, files }) =>
    ({ file }: { file: File }) => {
      const f = files.find(f => f.id === file.id)
      if (f) {
        Object.assign(f, file)
        $.dispatch.composed(host, 'edit')
      }
    }
  )

  _onchange = $(this).reduce(({ host, files }) =>
    ({ file }: { file: File }) => {
      const f = files.find(f => f.id === file.id)
      if (f) {
        Object.assign(f, file)
        $.dispatch.composed(host, 'change')
      }
    }
  )

  _onfontsize = $(this).reduce(({ $ }) =>
    ({ fontSize }: { fontSize: number }) => {
      $.fontSize = fontSize
    }
  )

  snapshot: any

  _onsnapshot = $(this).reduce(({ $ }) =>
    (snapshot: any) => {
      delete snapshot.call
      $.snapshot = snapshot
    }
  )

  setFromSnapshot = $(this).reduce(({ editor }) => (snapshot: any) => {
    return editor.setFromSnapshot(snapshot)
  })

  hoveringMarkerIndex?: number | null
  hoveringMarker?: Marker | null

  _onentermarker = $(this).reduce(({ $, host }) =>
    ({ markerIndex, marker }: { markerIndex: number, marker: Marker }) => {
      if (!~markerIndex) return
      $.hoveringMarkerIndex = markerIndex
      $.hoveringMarker = marker
      host.dispatch.composed('entermarker', { marker, markerIndex })
    }
  )

  _onleavemarker = $(this).reduce(({ $, host }) =>
    ({ markerIndex, marker }: { marker: Marker, markerIndex: number }) => {
      $.hoveringMarkerIndex = null
      $.hoveringMarker = null
      host.dispatch.composed('leavemarker', { marker, markerIndex })
    }
  )

  replaceChunk = $(this).reduce(({ editor }) => function callReplaceChunk(params: { start: number, end: number, text: string, code: string }) {
    return editor.replaceChunk(params)
  })


  setMarkers = $(this).reduce(({ editor }) => function setMarkers(markers: Marker[]) {
    return editor.onmarkers({ markers })
  })

  setLenses = $(this).reduce(({ editor }) => function setLenses(lenses: Lens[]) {
    return editor.setLenses({ lenses })
  })

  setValue = $(this).reduce(({ editor }) => function setValue(value: string, clearHistory?: boolean, scrollToTop?: boolean) {
    return editor.setValue({
      value,
      clearHistory,
      scrollToTop,
    })
  })

  mounted($: CanvyElement['$']) {
    $.effect(({ host, scene, _onblur }) => {
      host.tabIndex = 0
      return [
        $.on(host).focus((e) => {
          e.stopPropagation()
            ; ($.focusedFile ?? $.files[0])?.focus()
          scene.activeEditor = host
        }),
        $.on(host).blur((e) => {
          e.stopPropagation()
          if (scene.activeEditor === host) {
            _onblur()
            scene.activeEditor = null
          }
        }),
      ]
    })

    // this.opts = opts
    // this.opts.width ??= 300
    // this.opts.height ??= 300

    $.effect(({ host, scene }) => {
      scene.register(host)
    })

    // this.isVisible = true
    $.effect(() => {
      $.editor = new Editor()

      $.editor.on('ready', () => this._onready())
      // @ts-ignore
      $.editor.on('entermarker', (...args) => this._onentermarker(...args))
      // @ts-ignore
      $.editor.on('leavemarker', (...args) => this._onleavemarker(...args))
      // @ts-ignore
      $.editor.on('change', (...args) => this._onchange(...args))
      // @ts-ignore
      $.editor.on('edit', (...args) => this._onedit(...args))
      // @ts-ignore
      $.editor.on('selection', (...args) => this._onselection(...args))
      // @ts-ignore
      $.editor.on('focus', (...args) => this._onfocus(...args))
      // @ts-ignore
      $.editor.on('blur', (...args) => this._onblur(...args))
      // @ts-ignore
      $.editor.on('resize', (...args) => this._onresize(...args))
      // @ts-ignore
      $.editor.on('caret', (...args) => this.setCaret(...args))

      // const { port1, port2 } = new MessageChannel()

      // $.worker = new EditorWorker() as EditorWorker & Worker
      // // $.worker!.postMessage = ({ data }) => {
      // //   const method = '_' + data.call
      // //   if (!(method in this)) {
      // //     throw new Error('Editor: no such method: ' + method)
      // //   }
      // //   ; (this as any)['_' + data.call](data)
      // // }
      // $.worker.postMessage = (msg, xfer) => port2.postMessage(msg, xfer as any)

      // port2.onmessage = (ev) => $.worker.onmessage(ev)

      // $.rpc = rpc(port1, this as any)

      // $.worker!.onerror = error => host.dispatch('error' as any, error)

      // $.worker!.onmessage = ({ data }) => {
      //   const method = '_' + data.call
      //   if (!(method in this)) {
      //     throw new Error('Editor: no such method: ' + method)
      //   }
      //   ; (this as any)['_' + data.call](data)
      // }
    })

    $.effect(({ host }) =>
      $.observe.resize.initial(host, () => {
        $.rect = new $.Rect(host.getBoundingClientRect())
      })
    )

    // when size increases, we render immediately
    $.effect(({ canvas, editor, pixelRatio, rect: { size }, ready }) => {
      if (!ready) return

      requestAnimationFrame(() => {
        Object.assign(canvas.style, size.toStyleSize())
      })

      editor.onresize(size.scale(pixelRatio).toSizeObject())
    })

    // the raf here prevents initial flicker
    $.effect.once.raf(({ host, size, files, editor, canvas, pixelRatio }) => {
      if (files.length === 0) {
        const file = new File()
        file.value = $.initialValue ?? ''
        file.canvy = host
        files = $.files = [file]
      }

      files.forEach(file => {
        file.canvy = host
      })

      canvas.width = size.width
      canvas.height = size.height
      // Object.assign(canvas.style, size.scale(1 / pixelRatio).toStyleSize())

      editor.setup({
        ...size.scale(pixelRatio).toSizeObject(),
        font: $.font,
        fontSize: $.fontSize,
        singleComment: $.singleComment,
        titlebarHeight: 0,
        // autoResize: true,
        files: files.map(file => file.toJSON()),
        outerCanvas: canvas, // TODO: in a real worker situation this should be transferred
        pixelRatio,
      })
      // ,
      // [canvas as unknown as Transferable]
    })

    $.render(() => (
      <>
        <style>
          {/*css*/ `
          :host {
            position: relative;
            display: flex;
            width: 100%;
            height: 100%;
            outline: none;
            box-sizing: border-box;
            /* border-top: 3px dashed transparent; */
            /* overflow: hidden; */
            /* background: #44f4; */
          }
          :host(:focus) {
            z-index: 1000;
            /* border-top-color: #fff4; */
          }
          [part=canvas] {
            /* background: #44f4; */
            /* height: 100%; */
            /* width: 100%; */
          }
          :host(:not([ready])) [part=canvas] {
            display: none;
          }
        `}
        </style>
        <canvas part="canvas" ref={$.ref.canvas} />
      </>
    ))

    // this.canvas = document.createElement('canvas')
    // this.canvas.className = 'editor'
    // this.canvas.width = this.opts.width * pixelRatio
    // this.canvas.height = this.opts.height * pixelRatio
    // this.canvas.style.width = this.opts.width + 'px'
    // this.canvas.style.height = this.opts.height + 'px'

    // if (!opts.files) {
    //   this.files = []
    // } else {
    //   this.files = opts.files.map((file: Partial<File> | undefined) => new File(this, file))
    // }

    // if (this.files.length === 0) {
    //   this.files.push(new File(this))
    // }

    // this.focusedFile = this.files[0]

    // if (!this.opts.pseudoWorker) {
    //   const workerUrl = new URL('editor-worker.js', import.meta.url).href
    //   this.worker = new Worker(workerUrl, { type: 'module' })
    //   this.worker.onerror = error => this._onerror(error)
    //   this.worker.onmessage = ({ data }) => this['_' + data.call](data)
    // } else {
    // this.setupPseudoWorker().then(() => this.setup())
    // }
  }

  // toJSON() {
  //   return {
  //     files: this.files.map(file => file.toJSON()),
  //   }
  // }

  // setup() {
  //   const outerCanvas = this.opts.pseudoWorker ? this.canvas : this.canvas.transferControlToOffscreen()

  //     ; (this.worker as any).postMessage(
  //       {
  //         call: 'setup',
  //         ...this.opts,
  //         files: this.files.map(file => file.toJSON()),
  //         outerCanvas,
  //         pixelRatio,
  //       },
  //       [outerCanvas]
  //     )

  //   if (!this.files) {
  //     this.update()
  //   }
  // }

  // _onready() {
  //   this.queue.forEach((args: any) => (this.worker.postMessage as any)(...args))
  //   delete this.queue
  // }

  // async setupPseudoWorker() {
  //   this.queue = []
  //   this.worker = {} as any
  //   this.worker!.postMessage = (...args) => this.queue.push(args)
  //   const PseudoWorker = EditorWorker //(await import(new URL('editor-worker.js', import.meta.url))).default
  //   this.worker = new PseudoWorker() as any
  //   this.worker!.onerror = error => this._onerror(error)
  //   this.worker!.onmessage = ({ data }) => {
  //     const method = '_' + data.call
  //     if (!(method in this)) {
  //       throw new Error('Editor: no such method: ' + method)
  //     }
  //     ; (this as any)['_' + data.call](data)
  //   }
  //   this.worker!.terminate = () => {
  //     /**/
  //   }
  // }

  // destroy() {
  //   Editors.delete(this)
  //   this.worker.terminate()
  //   this.canvas.parentNode!.removeChild(this.canvas)
  //   events.destroy()
  //   this.ondestroy?.()
  // }
  // ondestroy() {
  //   // throw new Error('Method not implemented.')
  // }

  // addFile(data: Partial<File> | undefined) {
  //   const file = new File(this, data)
  //   this.files.push(file)
  //   this.worker.postMessage({
  //     call: 'addEditor',
  //     file,
  //   })
  //   this.oncreate?.(file)
  //   return file
  // }
  // oncreate(_file: File) {
  //   // throw new Error('Method not implemented.')
  // }

  // _onblockcomment() {
  //   this.onblockcomment?.()
  // }
  // onblockcomment() {
  //   // throw new Error('Method not implemented.')
  // }

  // _onerror(error: ErrorEvent) {
  //   console.error(error)
  // }

  // _setCaret({ caret }: any) {
  //   this.caret = caret
  //   events.caret = caret
  // }

  // // TODO: move to outside utility? this doesn't belong here
  // createStream() {
  //   this.stream = this.canvas.captureStream(15)
  //   this.videoTrack = this.stream.getVideoTracks()[0]
  //   // this.videoTrack.requestFrame()
  //   return this.stream
  // }

  // focus() {
  //   events.targets.focus = this
  //   if (document.hasFocus()) {
  //     this.worker.postMessage({ call: 'onfocus' })
  //   }
  // }

  // blur() {
  //   events.targets.focus = null
  //   // if (document.hasFocus()) {
  //   this.worker.postMessage({ call: 'onblur' })
  //   // }
  // }

  // update() {
  //   const promise = new Promise(resolve => (this.onupdate = resolve))
  //   this.worker.postMessage({ call: 'update' })
  //   return promise
  // }

  // _onupdate(data: { file: { id: any } }) {
  //   const file = this.getFileById(data.file.id)
  //   this._onchange(data)
  //   this.onupdate?.(file)
  // }

  // _onchange(data: { file: { id: any } }) {
  //   const file = this.getFileById(data.file.id)
  //   Object.assign(file, data.file)
  //   this.onchange?.(file)
  // }
  // onchange(_file: any) {
  //   // throw new Error('Method not implemented.')
  // }

  // _ondraw() {
  //   //   // this.videoTrack.requestFrame()
  // }

  // getFileById(id: any) {
  //   return this.files.find(file => file.id === id) ?? this.files[0]
  // }

  // _onfocus(data: { id: any }) {
  //   this.onbeforefocus?.(this.focusedFile)
  //   const file = this.getFileById(data.id)
  //   if (file) {
  //     this.focusedFile = file
  //     this.onfocus?.(file)
  //   }
  // }
  // onbeforefocus(_focusedFile: any) {
  //   // throw new Error('Method not implemented.')
  // }
  // onfocus(_file: any) {
  //   // throw new Error('Method not implemented.')
  // }

  // _onselection({ text }: { text: string }) {
  //   if (textarea) {
  //     if (text.length) {
  //       textarea.select()
  //     } else {
  //       textarea.selectionStart = -1
  //       textarea.selectionEnd = -1
  //     }
  //   }
  //   selectionText = text
  //   this.onselection?.(text)
  // }
  // onselection(_text: any) {
  //   // throw new Error('Method not implemented.')
  // }

  // getSelectionText() {
  //   return selectionText
  // }

  // send(data: any) {
  //   this.worker.postMessage(data)
  // }

  // offsetParent?: HTMLElement
  // appendTo(parent: HTMLElement | ShadowRoot, offsetParent: HTMLElement) {
  //   Editors.add(this)
  //   this.parent = parent
  //   this.parent.appendChild(this.canvas)
  //   this.offsetParent = offsetParent
  //   this.resize()
  //   setTimeout(() => {
  //     this.resize()
  //   }, 1000)
  //   // console.log(this.rect)
  //   // if (events.targets) {
  //   //   events.destroy()
  //   // }

  //   // TODO: should be parent not parent.parentNode
  //   // this is a quick workaround for not handling multiple
  //   // editors that belong to different parents correctly.
  //   // Unsure how to proceed, for now this works.
  //   // events.register(parent.parentNode.parentNode)
  // }

  // // TODO: is this needed?
  // _onresize() {
  //   // this.resize()
  //   // this.onresize?.()
  // }

  // resize({ width, height }: { width?: number; height?: number } = {}) {
  //   if (!this.offsetParent) return

  //   // this.parent = this.parent ?? this.canvas.parentNode
  //   // let rect
  //   // rect = Rect.fromElement(this.offsetParent).translate(new Point(getElementOffset(this.offsetParent)))
  //   // rect.y += window.pageYOffset
  //   // rect.x += window.pageXOffset
  //   // this.rect = rect
  //   // if ((width || height) && (rect.width !== width || rect.height !== height)) {
  //   this.worker.postMessage({
  //     call: 'onresize',
  //     width: this.opts.width! * pixelRatio,
  //     height: this.opts.height! * pixelRatio,
  //   })
  //   this.canvas.style.width = this.opts.width + 'px'
  //   this.canvas.style.height = this.opts.height + 'px'
  //   // rect = new Rect(this.canvas.offsetLeft, this.canvas.offsetTop, this.canvas.offsetWidth, this.canvas.offsetHeight)
  //   // rect = Rect.fromElement(this.offsetParent).translate(new Point(getElementOffset(this.offsetParent)))
  //   this.rect = Rect.fromElement(this.canvas).translate(new Point(getElementOffset(this.offsetParent)))
  //   this.rect.draw()
  //   // }
  // }

  // _onimagebitmap({ imageBitmap }: any) {
  //   this.imageBitmap = imageBitmap
  // }

  handleEvent = (eventName: string, data: object) => {
    if (this.hoveringMarker?.kind == 'param' && eventName === 'mousewheel') {
      this.dispatch('event', { name: eventName, data })
      return
    }

    //   // data=false means event is not handled by this system
    //   if (!data) return false

    //   // stopAndPrevent(e)

    //   const handled = (this as any)[eventName]?.(data, this.focusedFile ?? this.files[0], e)
    //   if (handled != null) {
    //     return false
    //   }
    ; (this.editor as any)['on' + eventName]({ ...data })
  }
}

export const Canvy = $.element(CanvyElement)
