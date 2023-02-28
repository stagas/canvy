import $ from 'sigl/worker'
import { Event } from 'zerolag'

// epic TODO: refactor pixelRatio mess

const isWorker = typeof window === 'undefined' && typeof postMessage !== 'undefined'

const escapeRegExp = (s: string) => s.replace(/\\/gm, '\\\\')

import { Regexp, Area, Point, Buffer, Syntax } from 'zerolag'
import { Lens, Marker } from './editor'

import { History } from './history'
// import themes from './themes.js'

function paintText(c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  color: string,
  x: number,
  y: number,
  stroke = false
) {
  if (stroke) {
    c.lineWidth = 1.95
    c.strokeStyle = '#0008'
    c.miterLimit = 2
    c.lineJoin = 'round'
    c.strokeText(text, x, y + 0.8)
  }

  c.fillStyle = color
  c.fillText(text, x, y)
}

type PointLike = Partial<Point>
// type AreaLike = Partial<Area>
const backgrounds = {
  // comment: '#53ea'
}

const colors = {
  background: '#000',
  buffer: '#94f',
  call: '#7bf',
  brackets: '#999',
  variable: '#48f',
  text: '#f99',
  marker: '#226',
  mark: '#43b',
  markHover: '#44a',
  caret: '#f4f4f4',
  gutter: '#333',
  scrollbar: '#6577',
  lineNumbers: '#888',
  titlebar: '#000',
  title: '#557',

  // background: "#000", //"#151515", //"#292923",
  // text: "#888", //"#f7f7f3",
  // variable: "#f11",
  attribute: '#fff', //"#95e124",
  definition: '#fff', //"#ffa910", //ff372f",
  keyword: '#954',
  operator: '#f42', //"#13bcff",
  property: '#fff', //"#a2a2af",
  // number: "#95e124", //"#fff", //"#f2e700", //"#fff", //"#ff69fe",
  number: '#ff5', // "#13bcff", //"#0f0", //"#ff69fe",
  string: '#fff',
  comment: '#666',
  symbol: '#888', // '#626288', //, '#6262f2',
  // mark: '#444',
  meta: '#fff',
  tag: '#fff',
  // gutter: 'rgba(0,0,0,.7)', //transparent',
  // caret: '#bbb',
  // titlebar: '#000', //rgba(0,0,50,.2)', //'#303030',
  // title: '#fff',
  // scrollbar: 'rgba(255,255,255,.07)', //', //'#3f30af',
  // lineNumbers: '#444'
}

const theme = {
  ...colors,
  // ...themes['wavepot'].highlights,
}

const Open: Record<string, string> = {
  '{': 'curly',
  '[': 'square',
  '(': 'parens',
}

const Close: Record<string, string> = {
  '}': 'curly',
  ']': 'square',
  ')': 'parens',
}

// const lines = (text: string) => text.split(/\n/g)
const NONSPACE = /[^\s]/g
const WORD = /[\s]{2,}|[./\\()"'\-:,.;<>~!@#$%^&*|+=[\]{}`~?\b ]{1}/g
const parse = (regexp: RegExp, text: any) => {
  regexp.lastIndex = 0
  let word
  const words = []
  while ((word = regexp.exec(text))) words.push(word)
  return words
}

interface Box {
  width: number
  height: number
}

const NEWLINE = Regexp.create(['newline'])
// const WORDS = Regexp.create(['words'], 'g')

// export default class PseudoWorker {
//   editor: Editor
//   rpc: Rpc
//   constructor() {
//     this.editor = new Editor()
//     this.editor.postMessage = data => this.onmessage({ data })
//     this.rpc = rpc(this, this.editor as any)
//   }
//   // onmessage(_arg0: { data: any }) {
//   //   // throw new Error('Method not implemented.')
//   // }

//   // postMessage(data: { call: string; id?: string }) {
//   //   if (!(data.call in this.editor)) {
//   //     throw new ReferenceError('EditorWorker: no such method: ' + data.call)
//   //   }
//   //   ; (this.editor as any)[data.call](data)
//   // }
// }

type AnimType = 'ease' | 'linear' | false | undefined

interface File {
  id: string
  title: string
  value?: string
}

interface Anim {
  speed: number
  type: AnimType
  isRunning: boolean
  animFrame: null
  threshold: { tiny: number; near: number; mid: number; far: number }
  scale: { tiny: number; near: number; mid: number; far: number }
}
export class Editor extends Event {
  isReady = false
  _deleted: any
  autoResize: any
  block: Area
  buffer: Buffer
  canvas!: { width: any; height: any; pixelRatio: any; padding: any } & Record<string, OffscreenCanvas | HTMLCanvasElement> & { scroll?: Box }
  caret!: { pos: Point; px: Point; align: number; width: number; height: any }
  char!: Partial<{ px: Box; offsetTop: number; metrics: TextMetrics; width: number; height: number }>
  color: any
  controlEditor: this
  ctx!: Record<string, CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D>
  extraTitle: any
  focusedEditor: Editor | null
  font: any
  fontName?: string | undefined
  fontAlias!: string
  fontSize: number
  gutter!: { padding: number; width: number; height: number; size?: number }
  hasFocus!: boolean
  history!: History
  id?: string
  isSubEditor!: boolean
  isVisible!: boolean
  key!: null | string
  keys!: Set<unknown>
  line!: { padding: number; height?: number }
  mark!: Area
  markActive!: boolean
  offsetTop: number
  padding!: Box
  page!: { lines?: number; height?: number }
  pressed!: string
  realOffsetTop: number
  scroll: { pos: Point; target: Point }
  scrollAnim: Partial<Anim>
  scrollbar!: { width: number; margin?: number; view?: Box; area?: Box; scale?: Box; horiz?: number; vert?: number }
  setupData: any
  sizes!: { loc: number; longestLineLength: number }
  subEditors: Editor[]
  subEditorsHeight: any
  syntax: Syntax
  tabSize!: number
  title: any
  titlebar!: { height: any; dir: any }
  usedMouseRight!: boolean
  view!: { left: number; top: any; width: any; height: number }
  constructor(data: Partial<Editor> = {}) {
    super()
    // TODO: this is a workaround
    // this.postMessage = self?.postMessage.bind(self)

    this.fontSize = data.fontSize ?? 11
    this.color = theme.variable
    this.block = new Area()
    this.scroll = { pos: new Point(), target: new Point() }
    this.offsetTop = 0
    this.realOffsetTop = 0
    this.subEditors = []
    this.controlEditor = this
    this.focusedEditor = null
    this.buffer = new Buffer()
    this.syntax = new Syntax({ tab: '\t' })
    this.drawSync = this.drawSync.bind(this)
    // this.highlightBlock = this.highlightBlock.bind(this)
    // this.scrollAnim = { speed: 165, isRunning: false, animFrame: null }
    // this.scrollAnim.threshold = { tiny: 9, near: .35, mid: 1.9, far: 1 }
    // this.scrollAnim.scale = { tiny: .296, near: .42, mid: .815, far: 2.85 }
    this.scrollAnim = { speed: 166, isRunning: false, animFrame: null }
    this.scrollAnim.threshold = { tiny: 21, near: 0.29, mid: 1.9, far: 0.1 }
    this.scrollAnim.scale = { tiny: 0.425, near: 0.71, mid: 0.802, far: 2.65 }
    this.animScrollStart = this.animScrollStart.bind(this)
    this.animScrollTick = this.animScrollTick.bind(this)

    // this.hasFocus = false
    // uncomment below for verbose debugging
    // this.verboseDebug()
  }

  // verboseDebug() {
  //   ;(Object.getOwnPropertyNames(this.constructor.prototype) as (keyof Editor)[]).forEach((key: keyof Editor) => {
  //     const method = this[key]
  //     if (typeof method !== 'function') return
  //     const err = {}
  //     if (key === 'isLastEditor') return
  //     this[key] = ((...args) => {
  //       Error.captureStackTrace(err)
  //       const parts = err.stack.split('\n').slice(0, 3).pop().trim().split(' ')
  //       console.log(
  //         (key + `(${JSON.stringify(args[0] ?? '')})`).padEnd(30),
  //         parts[1]?.padEnd(20),
  //         parts[2]?.split(':')?.slice(-2)[0]
  //       )
  //       return method.call(this, ...args)
  //     }) as any
  //   })
  // }

  update() {
    const editor = this.controlEditor.focusedEditor ?? this.controlEditor
    return {
      file: editor.toJSON(),
    }
  }

  // postMessage(_arg0: Record<string, any>) {
  //   throw new Error('Method not implemented.')
  // }

  toJSON() {
    return {
      controlEditor: { id: this.controlEditor.id },
      id: this.id,
      title: this.title,
      value: this.buffer.toString(),
    }
  }

  lastTexts: string[] = []

  saveHistory(force?: boolean, noEmit = false) {
    this.controlEditor.history.setEditor(this)
    return this.controlEditor.history.save(force, noEmit)
  }

  clearHistory() {
    this.controlEditor.history.setEditor(this)
    this.controlEditor.history.clear()
  }

  singleComment?: string
  singleCommentRegExp?: RegExp

  lastSnapshot: any

  async setup(
    data: {
      outerCanvas?: any
      extraTitle?: any
      font?: any
      fontName?: string
      fontSize?: any
      autoResize?: any
      padding?: any
      titlebarHeight?: any
      titlebarDir?: any
      files?: any
      pixelRatio?: any
      singleComment?: string
    },
    controlEditor?: this
  ) {
    const { pixelRatio } = data
    const { width, height } = data.outerCanvas

    this.setupData = data
    this.extraTitle = data.extraTitle ?? ''
    this.font = data.font
    this.fontName = data.fontName
    this.fontSize = data.fontSize ?? this.fontSize
    this.autoResize = data.autoResize ?? this.autoResize

    this.singleComment = data.singleComment ?? '//'

    this.singleCommentRegExp = new RegExp(`^([^${escapeRegExp(this.singleComment)}]*)${escapeRegExp(this.singleComment)} ?`, 'gm')

    try {
      // TODO: use a utility to extract regexp group
      const {
        groups: { color },
      } = /(?:color\(')(?<color>[^']+)/gi.exec(this.value as any)! as any
      if (color) {
        this.color = color
      }
    } catch (err) { }

    this.controlEditor = controlEditor ?? this.controlEditor
    this.isSubEditor = !!this.controlEditor && this.controlEditor !== this

    this.buffer.on('update', () => {
      this.saveHistory()
      this.updateText()
      this.updateMark()
    })
    this.buffer.on('before update', () => {
      this.saveHistory(false, true)
      this.updateText()
      this.updateMark()
    })

    if (this.font) {
      this.fontAlias = 'mono'
    } else if (this.fontName) {
      this.fontAlias = this.fontName
    } else {
      this.fontAlias = 'monospace'
    }
    if (!controlEditor && this.font) {
      const fontFace = new FontFace(
        this.fontAlias,
        `local('${this.fontAlias}'),
         url('${this.font}') format('woff2')`
      )
      if (isWorker) {
        ; (self as any).fonts.add(fontFace)
      } else {
        ; (document as any).fonts.add(fontFace)
      }
      await fontFace.load()
    }

    const createCanvas = (width: number, height: number) => {
      if (isWorker) {
        const canvas = new OffscreenCanvas(width, height)
        return canvas
      } else {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        return canvas
      }
    }

    this.canvas = { width, height, pixelRatio, padding: data.padding ?? 3 }
    this.canvas.outer = this.canvas.outerCanvas = data.outerCanvas
    this.canvas.gutter = createCanvas(width, height)
    this.canvas.title = createCanvas(width, height)
    this.canvas.mark = createCanvas(width, height)
    this.canvas.back = createCanvas(width, height)
    this.canvas.text = createCanvas(width, height)
    this.canvas.debug = createCanvas(width, height)
    this.canvas.scroll = {
      width: this.canvas.width,
      height: this.canvas.height - this.canvas.padding * this.canvas.pixelRatio,
    }

    this.ctx = {}
    this.ctx.outer = this.canvas.outer.getContext('2d')!
    this.ctx.gutter = this.canvas.gutter.getContext('2d')!
    this.ctx.title = this.canvas.title.getContext('2d')!
    this.ctx.mark = this.canvas.mark.getContext('2d')!
    this.ctx.back = this.canvas.back.getContext('2d')!
    this.ctx.text = this.canvas.text.getContext('2d')!
    this.ctx.debug = this.canvas.debug.getContext('2d')!
    // this.ctx.debug.scale(this.canvas.pixelRatio, this.canvas.pixelRatio)

    this.key = null
    this.keys = new Set()

    this.sizes = { loc: -1, longestLineLength: -1 }

    this.hasFocus = false

    this.tabSize = 2

    this.char = {}
    this.updateChar()

    this.markActive = false
    this.mark ??= new Area({
      begin: new Point({ x: -1, y: -1 }),
      end: new Point({ x: -1, y: -1 }),
    })

    // let snapshot: any

    if (!this.isSubEditor && !this.history) {
      this.history = new History(this)
      // this.history.on('save', editor => {
      //   // console.log('yeaH?', editor.toJSON())
      //   // this.postMessage({
      //   //   call: 'onchange',
      //   //   file: editor.toJSON(),
      //   // })
      //   // console.log('save history')
      //   // this.postMessage({
      //   //   call: 'onhistory',
      //   //   ...this.history.toJSON()
      //   // })
      // })
      this.history.on('change', editor => {
        // console.log('change')
        this.emit('change', {
          file: editor.toJSON(),
        })
      })

      this.history.on('edit', editor => {
        // console.log('edit')
        const file = editor.toJSON()
        // this.lastTexts.push(file.value as string)
        // if (this.lastTexts.length > 5) this.lastTexts.shift()
        this.emit('edit', {
          file,
        })
        // this.lastSnapshot = snapshot
        // snapshot = this.getSnapshotJson()
      })
    }

    if (!this.isSubEditor) {
      this.setData(data.files[0])
      for (const file of data.files.slice(1)) {
        const editor = await this.addSubEditor()
        editor.setData(file)
      }
      this.subEditors.forEach(editor => {
        editor.updateSizes(true)
        editor.updateText()
        editor.updateMark()
      })
    }

    this.setCaret({ x: 0, y: 0 })
    this.draw()

    this.isReady = true
    // snapshot = this.lastSnapshot = this.getSnapshotJson()

    if (!this.isSubEditor) {
      setTimeout(() => {
        this.emit('ready')
      })
    }
  }

  value(_value: any): { groups: { color: any } } {
    throw new Error('Method not implemented.')
  }

  get isLastEditor(): boolean {
    const length = this.controlEditor.subEditors.length
    return length === 0 || this.controlEditor.subEditors.indexOf(this) === length - 1
  }

  async addSubEditor() {
    const editor = new Editor()

    // TODO: this is a workaround
    // editor.postMessage = this.postMessage

    await editor.setup(this.setupData, this)
    this.subEditors.push(editor)
    return editor
  }

  updateChar = () => {
    this.applyFont(this.ctx.text)

    this.char.offsetTop = 0.5
    this.char.metrics = this.ctx.text.measureText('M')
    this.char.width = this.char.metrics.width
    this.char.height = Math.round((this.char.metrics.actualBoundingBoxDescent - this.char.metrics.actualBoundingBoxAscent) * 1.15) //.96 //1.68
    // this.char.metrics.emHeightDescent
    this.gutter = { padding: 7, width: 0, height: 0 }

    this.line = { padding: 4 }
    this.line.height = this.char.height + this.line.padding

    this.char.px = {
      width: this.char.width * this.canvas.pixelRatio,
      height: this.line.height * this.canvas.pixelRatio,
    }

    this.padding = { width: 0, height: this.char.px.height }

    this.titlebar = {
      height: 'titlebarHeight' in this.setupData ? this.setupData.titlebarHeight * this.canvas.pixelRatio : this.char.px.height + 2.5,
      dir: this.setupData.titlebarDir ?? 0,
    }
    this.canvas.title.height = Math.max(1, this.titlebar.height)

    this.scrollbar = { width: 12 }
    this.scrollbar.margin = Math.ceil(this.scrollbar.width / 2)
    this.scrollbar.view = {
      width: 0,
      height: this.canvas.height - this.titlebar.height,
    }
    this.scrollbar.area = { width: 0, height: 0 }
    this.scrollbar.scale = { width: 0, height: 0 }

    this.view = {
      left: 0,
      top: this.titlebar.height,
      width: this.canvas.width,
      height: this.canvas.height - this.titlebar.height,
    }

    this.page ??= {}
    this.page.lines = Math.floor(this.view.height / this.char.px.height)
    this.page.height = this.page.lines * this.char.px.height

    this.caret = {
      pos: this.caret?.pos ?? new Point(),
      px: this.caret?.px ?? new Point(),
      align: this.caret?.align || 0,
      width: 1, //(this.fontSize / 8) | 0,
      height: this.line.height,
    }
  }

  setColor({ color }: { color: string }) {
    if (this.focusedEditor && color !== this.focusedEditor.color) {
      this.focusedEditor.color = color
      this.focusedEditor.updateText()
      this.focusedEditor.updateMark()
      this.controlEditor.draw()
    }
  }

  getEditorById(id: any) {
    if (id === this.id) return this
    return this.subEditors.find(editor => editor.id === id)
  }

  setFocusedEditorById({ id }: { id: string }) {
    const editor = this.getEditorById(id)!
    if (editor) this.setFocusedEditor(editor)
  }

  async addEditor({ file }: { file: File }) {
    if (this._deleted) {
      this._deleted = false
      this.setData(file)
      this.updateSizes(true)
      this.updateText()
      this.updateMark()
    } else {
      const editor = await this.addSubEditor()
      editor.setData(file)
      this.subEditors.forEach(editor => {
        editor.updateSizes(true)
        editor.updateText()
        editor.updateMark()
      })
    }
  }

  swapEditors(a: Editor, b: Editor) {
    const data = a.toJSON()
    const caretA = a.caret.pos.copy()
    const caretB = b.caret.pos.copy()

    const history = this.saveHistory(true).toJSON()

    a.setData(b.toJSON() as any)
    b.setData(data as any)

    a.updateTitle()
    a.updateSizes(true)
    a.updateText()
    a.updateMark()

    b.updateTitle()
    b.updateSizes(true)
    b.updateText()
    b.updateMark()

    b.setCaret(caretA)
    a.setCaret(caretB)

    this.history.clear()
    this.restoreHistory(history)

    this.draw()
  }

  getSnapshotJson(force?: boolean) {
    return {
      value: this.buffer.toString(),
      caret: this.caret.pos.copy(),
      scroll: this.scroll.pos.copy(),
      history: this.history.toJSON(force)
    }
  }

  getLastSnapshotJson() {
    return this.lastSnapshot
  }

  setFromSnapshot(snapshot: any, noScroll?: boolean) {
    this.markClear()
    this.buffer.setText(snapshot.value)

    this.updateTitle()
    this.updateSizes(true)
    this.updateText()
    this.updateMark()

    this.history.clear()
    if (snapshot.caret && snapshot.scroll && snapshot.history) {
      if (!noScroll) {
        this.scrollTo(snapshot.scroll)
        this.setCaret(snapshot.caret)
      }
      this.restoreHistory(snapshot.history)
    } else {
      this.scrollTo({ x: 0, y: 0 })
      this.setCaret({ x: 0, y: 0 })
    }
    // this.setFocusedEditor(this)
    this.drawSync()
  }

  moveEditorUp({ id }: { id: string }) {
    const self = this.getEditorById(id)!
    if (self === this) {
      return
    } else {
      let other
      const index = this.subEditors.indexOf(self)
      if (index === 0) {
        other = this.controlEditor
      } else {
        other = this.subEditors[index - 1]
      }
      this.swapEditors(self, other)
    }
    this.setFocusedEditor(this.getEditorById(id)!)
    setTimeout(() => this.keepCaretInView(false, true))
  }

  moveEditorDown({ id }: { id: string }) {
    const self = this.getEditorById(id)!
    if (self === this) {
      if (this.subEditors.length) {
        const other = this.subEditors[0]
        this.swapEditors(self, other)
      }
    } else {
      const other = this.subEditors[this.subEditors.indexOf(self) + 1]
      if (!other) return
      this.swapEditors(self, other)
    }
    this.setFocusedEditor(this.getEditorById(id)!)
    setTimeout(() => this.keepCaretInView(false, true))
  }

  deleteEditor({ id }: { id: string }) {
    const editor = this.getEditorById(id)!

    const history = this.saveHistory(true).toJSON()

    if (editor === this) {
      if (this.subEditors.length) {
        const other = this.subEditors.shift()!
        this.setData(other.toJSON() as any)
        this.setCaret(other.caret.pos.copy())
      } else {
        this._deleted = true // TODO: this is a hack to keep track that it's not an actual file
        this.setText('')
        this.setCaret({ x: 0, y: 0 })
      }
      this.setFocusedEditor(this)
    } else {
      const index = this.subEditors.indexOf(editor)
      this.subEditors.splice(index, 1)
      const lastEditor = this.subEditors[index] ?? this.subEditors[index - 1] ?? this
      lastEditor.updateSizes(true)
      lastEditor.updateText()
      lastEditor.updateMark()
      this.setFocusedEditor(lastEditor)
    }

    this.history.clear()
    this.restoreHistory(history)
    this.keepCaretInView()
    this.updateSizes(true)
    this.updateText()
    this.updateMark()
    this.draw()
  }

  setEditorData({ id, data }: { id: string; data: File }) {
    const editor = this.getEditorById(id) || this
    editor.setData(data)
    try {
      editor.updateTitle()
      editor.updateSizes()
      editor.updateText()
      editor.updateMark()
      this.draw()
    } catch (error) {
      console.error(error)
    }
  }

  restoreHistory(history: Partial<History>) {
    const editors: Record<string, Editor> = {}
    editors[this.id!] = this
    this.subEditors.forEach(editor => {
      editors[editor.id!] = editor
    })

    const log = history.log!.filter((item, i) => {
      if (item) {
        item.editor = editors[item.editor]
        if (!item.editor) {
          if (i < history.needle!) {
            history.needle!--
          }
          if (i < history.lastNeedle!) {
            history.lastNeedle!--
          }
          return false
        }

        item.undo.editor = editors[item.undo.editor]
        item.undo.caret = new Point(item.undo.caret)
        item.undo.mark = new Area(item.undo.mark)

        item.redo.editor = editors[item.redo.editor]
        item.redo.caret = new Point(item.redo.caret)
        item.redo.mark = new Area(item.redo.mark)
      }
      return true
    })
    this.history.log = log
    this.history.needle = history.needle!
    this.history.lastNeedle = history.lastNeedle!
  }

  setData(data: File) {
    if ('id' in data) this.id = data.id
    if ('title' in data) this.title = data.title
    if ('value' in data) this.setText(data.value ?? '')
  }

  erase(moveByChars = 0, inView = true, noHistory = false, noDraw = false) {
    if (this.readableOnly) return

    if (this.markActive && !this.mark.isEmpty()) {
      if (!noHistory) {
        this.saveHistory(true)
      }
      const area = this.mark.get()
      this.moveCaret(area.begin)
      this.buffer.removeArea(area, noHistory)
      this.markClear(true)
    } else {
      this.markClear(true)
      if (!noHistory) {
        this.saveHistory()
      }
      if (moveByChars) this.moveByChars(moveByChars)
      // const left = line[this.caret.pos.x]
      // let line = this.buffer.getLineText(this.caret.pos.y)
      // const hasLeftSymbol = ['{','[','(','\'','"','`'].includes(left)
      this.buffer.removeCharAtPoint(this.caret.pos)
      // line = this.buffer.getLineText(this.caret.pos.y)
      // const right = line[this.caret.pos.x]
      // const hasRightSymbol = ['\'','"','`','}',']',')'].includes(right)
      // if (hasLeftSymbol && hasRightSymbol) this.buffer.removeCharAtPoint(this.caret.pos)
    }

    if (!noDraw) {
      this.updateSizes()
      this.updateText()
      this.updateMark()
      if (inView) this.keepCaretInView('ease', false)
      this.draw()
      this.highlightBlock()
    }
  }

  align() {
    this.caret.align = this.caret.pos.x
  }

  delete(inView?: boolean, noHistory?: boolean, noDraw?: boolean): void {
    if (this.readableOnly) return

    if (this.isEndOfFile()) {
      if (this.markActive && !this.isBeginOfFile()) return this.backspace(inView, noHistory)
      return
    }
    this.erase(0, inView, noHistory, noDraw)
  }

  backspace(inView?: boolean, noHistory?: boolean) {
    if (this.readableOnly) return

    if (this.isBeginOfFile()) {
      if (this.markActive && !this.isEndOfFile()) return this.delete(inView, noHistory)
      return
    }
    this.erase(-1, inView, noHistory)
  }

  insert(text: string, noRules = false, inView = true, noLog = false, noUpdateMark = false) {
    if (this.readableOnly) return

    if (this.markActive && !this.mark.isEmpty()) this.delete(inView, noLog, noUpdateMark)
    this.markClear()
    // this.emit('input', text, this.caret.copy(), this.mark.copy(), this.mark.active);

    const matchSymbol: Record<string, string> = {
      "'": "'",
      '"': '"',
      '`': '`',
      '(': ')',
      '[': ']',
      '{': '}',
      ')': '(',
      ']': '[',
      '}': '{',
    }

    const line = this.buffer.getLineText(this.caret.pos.y)
    const right = line[this.caret.pos.x]
    let left = line[this.caret.pos.x - 1]
    const hasRightSymbol = ["'", '"', '`', '}', ']', ')'].includes(right)
    const hasMatchSymbol = hasRightSymbol && text === right && matchSymbol[left] === right

    let indent = 0
    let hasLeftSymbol

    // apply indent on enter
    if (!noRules && NEWLINE.test(text)) {
      left = line.slice(0, this.caret.pos.x).trim().slice(-1)
      // const isEndOfLine = this.caret.pos.x >= line.trim().length - 1 // TODO: !!!!!!!!!
      hasLeftSymbol = ['{', '[', '('].includes(left)
      indent = line.match(/\S/)?.index ?? (line.length || 1) - 1
      const isBeforeIndent = this.caret.pos.x < indent

      if (hasLeftSymbol) indent += 2

      // if (isEndOfLine || hasLeftSymbol) {
      if (!isBeforeIndent) {
        text += ' '.repeat(indent)
      }
      // }
    }

    if (!noRules) {
      if (hasLeftSymbol && hasRightSymbol) {
        this.buffer.insert(this.caret.pos, '\n' + ' '.repeat(indent - 2))
      }
    }

    let length = 1

    if (noRules || !hasMatchSymbol) {
      length = this.buffer.insert(this.caret.pos, text, noLog)
      this.updateSizes()
    }

    this.moveByChars(length)

    // if ('{' === text) this.buffer.insert(this.caret.pos, '}')
    // else if ('(' === text) this.buffer.insert(this.caret.pos, ')')
    // else if ('[' === text) this.buffer.insert(this.caret.pos, ']')
    // else if ('\'' === text) this.buffer.insert(this.caret.pos, '\'')
    // else if ('"' === text) this.buffer.insert(this.caret.pos, '"')
    // else if ('`' === text) this.buffer.insert(this.caret.pos, '`')

    this.updateSizes()
    this.updateText()
    if (!noUpdateMark) {
      this.updateMark()
    }
    if (inView) this.keepCaretInView()
    this.draw()
    this.highlightBlock()
  }

  markBegin(area?: Area | false) {
    if (!this.markActive) {
      this.markActive = true
      if (area) {
        this.mark.set(area)
      } else if (area !== false || this.mark.begin.x === -1) {
        this.mark.begin.set(this.caret.pos)
        this.mark.end.set(this.caret.pos)
      }
    }
  }

  markSet(reverse?: boolean, noDraw = false) {
    if (this.markActive) {
      if (reverse) {
        this.mark.end.set(this.mark.begin)
        this.mark.begin.set(this.caret.pos)
        this.caret.pos.set(this.mark.end)
      } else {
        this.mark.end.set(this.caret.pos)
      }
      if (!noDraw) {
        this.updateMark()
        this.draw()
      }
    }
  }

  markSetArea(area: any) {
    this.markBegin(area)
    this.updateMark()
    this.draw()
  }

  markClear(force?: boolean) {
    if ((this.keys.has('Shift') && !force) || !this.markActive) return

    this.emit('selection', { text: '' })

    this.markActive = false
    this.mark.set({
      begin: new Point({ x: -1, y: -1 }),
      end: new Point({ x: -1, y: -1 }),
    } as Area)
    this.draw()
  }

  getPointTabs({ x, y }: Partial<Point>) {
    const line = this.buffer.getLineText(y!)
    let remainder = 0
    let tabs = 0
    let tab = -1
    let prev = 0
    while (~(tab = line.indexOf('\t', tab + 1))) {
      if (tab >= x!) break
      remainder += (tab - prev) % this.tabSize
      tabs++
      prev = tab + 1
    }
    remainder += tabs
    return { tabs, remainder }
  }

  getCoordsTabs({ x, y }: Partial<Point>) {
    const line = this.buffer.getLineText(y!)

    const { tabSize } = this

    let displayIndex = 0
    let i = 0
    for (i = 0; i < line.length; i++) {
      if (displayIndex >= x!) break
      if (line[i] === '\t') displayIndex += tabSize
      else displayIndex += 1
    }

    return i
  }

  highlightBlock = $.queue.task(() => {
    this.block.begin.set({ x: -1, y: -1 })
    this.block.end.set({ x: -1, y: -1 })

    const offset = this.buffer.getPoint(this.caret.pos).offset

    const result = this.buffer.tokens.getByOffset('blocks', offset)
    if (!result) return

    const length = this.buffer.tokens.getCollection('blocks').length

    let char = this.buffer.charAt(result.index) // TODO: this was charAt(result), bug?

    let open
    let close

    let i = result.index
    let openOffset = result.offset
    if (i === 0 && offset < openOffset) return

    char = this.buffer.charAt(openOffset)

    let count = openOffset >= offset - 1 && Close[char] ? 0 : 1

    let limit = 200

    while (i >= 0) {
      open = Open[char]
      if (Close[char]) count++
      if (!--limit) return

      if (open && !--count) break

      openOffset = this.buffer.tokens.getByIndex('blocks', --i)
      char = this.buffer.charAt(openOffset)
    }

    if (count) return

    count = 1

    let closeOffset: number

    while (i < length - 1) {
      closeOffset = this.buffer.tokens.getByIndex('blocks', ++i)
      char = this.buffer.charAt(closeOffset)
      if (!--limit) return

      close = Close[char]
      if (Open[char] === open) count++
      if (open === close) count--

      if (!count) break
    }

    if (count) return

    const begin = this.buffer.getOffsetPoint(openOffset)
    const end = this.buffer.getOffsetPoint(closeOffset!) // TODO: ????????

    this.block.begin.set(this.getCharPxFromPoint(begin))
    this.block.end.set(this.getCharPxFromPoint(end))
  })

  moveByWords(dx: number) {
    // eslint-disable-next-line prefer-const
    let { x, y } = this.caret.pos
    const line = this.buffer.getLineText(y)

    if (dx > 0 && x >= line.length - 1) {
      // at end of line
      return this.moveByChars(+1) // move one char right
    } else if (dx < 0 && x === 0) {
      // at begin of line
      return this.moveByChars(-1) // move one char left
    }

    const words = parse(WORD, dx > 0 ? line : [...line].reverse().join(''))
    let word

    if (dx < 0) x = line.length - x

    for (let i = 0; i < words.length; i++) {
      word = words[i]
      if (word.index > x) {
        x = dx > 0 ? word.index : line.length - word.index
        // this.caret.align = x
        return this.moveCaret({ x, y })
      }
    }

    // reached begin/end of file
    return dx > 0 ? this.moveEndOfLine() : this.moveBeginOfLine()
  }

  moveByChars(dx: number) {
    let { x, y } = this.caret.pos

    if (dx < 0) {
      // going left
      x += dx // move left
      if (x < 0) {
        // when past left edge
        if (y > 0) {
          // and lines above
          y -= 1 // move up a line
          x = this.buffer.getLineLength(y) // and go to the end of line
        } else {
          x = 0
        }
      }
    } else if (dx > 0) {
      // going right
      x += dx // move right
      while (x - this.buffer.getLineLength(y) > 0) {
        // while past line length
        if (y === this.sizes.loc) {
          // on end of file
          x = this.buffer.getLineLength(y) // go to end of line on last line
          break // and exit
        }
        x -= this.buffer.getLineLength(y) + 1 // wrap this line length
        y += 1 // and move down a line
      }
    }

    this.caret.align = x
    return this.moveCaret({ x, y })
  }

  moveByLines(dy: number) {
    let { x, y } = this.caret.pos

    if (dy < 0) {
      // going up
      if (y + dy > 0) {
        // when lines above
        y += dy // move up
      } else {
        // return
        if (y === 0) { // if already at top line
          x = 0 // move caret to begin of line
          //   return this.moveCaret({ x, y })
          return this.moveCaret({ x, y })
        }
        y = 0
      }
    } else if (dy > 0) {
      // going down
      if (y < this.sizes.loc - dy) {
        // when lines below
        y += dy // move down
      } else {
        // return
        if (y === this.sizes.loc) { // if already at bottom line
          x = this.buffer.getLineLength(y) // move caret to end of line
          // return this.moveCaret({ x, y })
          return this.moveCaret({ x, y })
        }
        y = this.sizes.loc
      }
    }

    x = Math.min(this.caret.align, this.buffer.getLineLength(y))
    return this.moveCaret({ x, y })
  }

  moveBeginOfLine({ isHomeKey = false } = {}) {
    const y = this.caret.pos.y
    let x = 0
    if (isHomeKey) {
      // home key oscillates begin of visible text and begin of line
      const lineText = this.buffer.getLineText(y)
      NONSPACE.lastIndex = 0
      x = NONSPACE.exec(lineText)?.index ?? 0
      if (x === this.caret.pos.x) x = 0
    }
    this.caret.align = x
    return this.moveCaret({ x, y })
  }

  moveEndOfLine() {
    const y = this.caret.pos.y
    const x = this.buffer.getLine(y).length
    this.caret.align = Infinity
    return this.moveCaret({ x, y })
  }

  moveBeginOfFile() {
    this.caret.align = 0
    return this.moveCaret({ x: 0, y: 0 })
  }

  moveEndOfFile() {
    const y = this.sizes.loc
    const x = this.buffer.getLine(y).length
    this.caret.align = x
    return this.moveCaret({ x, y })
  }

  isBeginOfFile() {
    return this.caret.pos.x === 0 && this.caret.pos.y === 0
  }

  isEndOfFile() {
    const { x, y } = this.caret.pos
    const last = this.sizes.loc
    return y === last && x === this.buffer.getLineLength(last)
  }

  isBeginOfLine() {
    return this.caret.pos.x === 0
  }

  isEndOfLine() {
    return this.caret.pos.x === this.buffer.getLineLength(this.caret.pos.y)
  }

  moveCaret({ x, y }: PointLike) {
    return this.setCaret({ x: x!, y: y! })
  }

  // scrollIntoView(_target: any) {} // TODO: ?????????

  getCaretPxDiff(centered = false) {
    let editor = this.controlEditor.focusedEditor
    if (!editor) {
      this.controlEditor.setFocusedEditor(this)
      editor = this
    }

    let left = this.canvas.gutter.width
    let top = this.titlebar.height
    let right = left + (this.view.width - this.scrollbar.width - this.char.px!.width)
    let bottom = this.view.height - this.char.px!.height

    // if (centered) {
    //   left = right / 2
    //   right = right / 2
    //   top = bottom / 2
    //   bottom = bottom / 2
    // }
    // this.controlEditor.ctx.debug.clearRect(0, 0, this.canvas.width, this.canvas.height)
    // this.controlEditor.ctx.debug.fillStyle = 'rgba(255,0,0,.5)'
    // this.controlEditor.ctx.debug.fillRect(left, top, right-left, bottom-top)
    // this.drawSync()

    const x = editor.caret.px.x * this.canvas.pixelRatio + this.canvas.gutter.width - this.scroll.pos.x
    const y = editor.caret.px.y * this.canvas.pixelRatio + this.titlebar.height + editor.offsetTop - editor.scroll.pos.y + this.canvas.padding * this.canvas.pixelRatio - this.canvas.pixelRatio

    let dx = Math.floor(x < left ? left - x : x > right ? right - x : 0)

    let dy = Math.floor(y < top ? top - y : y > bottom ? bottom - y : 0)

    if (dx !== 0 && centered) {
      left = right / 2
      right = right / 2
      dx = x < left ? left - x : x > right ? right - x : 0
    }

    if (dy !== 0 && centered) {
      top = bottom / 2
      bottom = bottom / 2
      dy = y < top ? top - y : y > bottom ? bottom - y : 0
    }

    return new Point({ x: dx, y: dy })
  }

  getCharPxFromPoint(point: Point) {
    const { tabs } = this.getPointTabs(point)
    return new Point({
      x: this.char.width! * (point.x - tabs + tabs * this.tabSize) + this.gutter.padding,
      y: this.line.height! * point.y + this.canvas.padding - this.line.padding,
    })
  }

  setCaret(pos: Point | PointLike) {
    const prevCaretPos = this.caret.pos.copy()
    this.caret.pos.set(Point.low({ x: 0, y: 0 }, pos))
    const px = this.getCharPxFromPoint(this.caret.pos)
    // const { tabs } = this.getPointTabs(this.caret.pos) // TODO: ????????????
    this.caret.px.set({
      x: px.x,
      y: px.y,
    })
    this.highlightBlock()
    this.emit('caret', { caret: this.caret.pos })
    return prevCaretPos.minus(this.caret.pos)
  }

  getPointByMouse({ clientX, clientY }: { clientX: number; clientY: number }, round?: boolean) {
    const y = Math.max(
      0,
      Math.min(
        this.sizes.loc,
        Math.floor(
          (clientY -
            (-this.scroll.pos.y / this.canvas.pixelRatio +
              this.offsetTop / this.canvas.pixelRatio +
              this.canvas.padding +
              this.titlebar.height / this.canvas.pixelRatio)) /
          this.line.height!
        )
      )
    )

    let x = Math.max(0,
      Math[round ? 'round' : 'ceil'](
        (clientX - (this.padding.width) / this.canvas.pixelRatio - (-this.scroll.pos.x) / this.canvas.pixelRatio + 1
        ) / this.char.width!))

    const actualIndex = this.getCoordsTabs({ x, y })

    x = Math.max(0, Math.min(actualIndex, this.buffer.getLineLength(y)))

    return new Point({ x, y })
  }

  setCaretByMouse({ clientX, clientY }: { clientX: number; clientY: number }) {
    const p = this.getPointByMouse({ clientX, clientY })
    this.caret.align = p.x
    this.setCaret(p)
    this.keepCaretInView()
  }

  setText(text: string) {
    this.buffer.setText(text)
    if (this.updateSizes()) {
      this.updateText()
      this.updateMark()
    }
  }

  updateSizes(force = false) {
    if (!this.sizes) return

    let changed = false

    const loc = this.buffer.loc()

    const lensSize = Math.max(0, ...Object.values(this.lenses).map(x => x.length))

    // TODO: need to pass lenses here to get the right longest line length
    const longestLine = this.buffer.getLongestLine() as unknown as { length: number; lineNumber: number }

    const { tabs, remainder } = this.getPointTabs({
      x: longestLine.length,
      y: longestLine.lineNumber,
    })

    const longestLineLength = longestLine.length + tabs + remainder
      + (lensSize ? lensSize + 2 : 0)

    if (loc !== this.sizes.loc || force) {
      changed = true
      this.sizes.loc = loc
      this.view.height = this.canvas.height
      this.scrollbar.view!.height = this.canvas.height - this.titlebar.height

      // this.gutter.size = (1 + this.sizes.loc).toString().length
      this.gutter.size = 0
      // this.gutter.width = this.gutter.size * this.char.width + this.gutter.padding
      this.gutter.width = 0
      this.gutter.padding = 0

      this.canvas.back.height = this.canvas.text.height =
        // this.canvas.padding *
        this.canvas.pixelRatio * 2 - 1
        + (1 + this.sizes.loc) * this.char.px!.height // line.height)
      // * this.canvas.pixelRatio

      if (!isWorker && this.autoResize && !this.isSubEditor) {
        this.view.height =
          this.canvas.height =
          this.canvas.outer.height =
          this.canvas.text.height + this.titlebar.height + this.canvas.padding * this.canvas.pixelRatio
        this.page.lines = Math.floor(this.view.height / this.char.px!.height)
          ; (this.canvas.outer as HTMLCanvasElement).style.height = this.canvas.outer.height / this.canvas.pixelRatio + 'pt'
        this.emit('resize', { width: this.canvas.width, height: this.canvas.height })
      }

      this.subEditorsHeight = this.subEditors.reduce((p, n) => p + n.canvas.text.height + this.titlebar.height, 0)

      this.canvas.scroll!.height = Math.floor(
        this.subEditorsHeight +
        Math.max(0, (!isWorker && this.autoResize
          ? 0
          : this.canvas.text.height
          // - this.canvas.padding * this.canvas.pixelRatio * 4
          + 1
        )
          - this.page!.height!
        )

        // -
        // (this.canvas.padding + this.caret.height - this.line.padding) * this.canvas.pixelRatio
      )
      // + 4 // TODO: this shouldn't be needed

      // + (this.subEditors.length - 2)

      this.canvas.gutter.width = (this.gutter.width + this.canvas.padding) * this.canvas.pixelRatio

      this.canvas.gutter.height = !this.isLastEditor // TODO
        ? this.canvas.text.height
        : this.canvas.scroll!.height + this.view.height

      this.scrollbar.view!.width = this.canvas.width - this.canvas.gutter.width

      this.view.left = this.canvas.gutter.width
      this.view.width = this.canvas.width - this.canvas.gutter.width

      this.padding.width = (this.gutter.width + this.gutter.padding + this.char.width!) * this.canvas.pixelRatio

      this.ctx.gutter.scale(this.canvas.pixelRatio, this.canvas.pixelRatio)
      this.updateGutter()
    }

    if (longestLineLength !== this.sizes.longestLineLength || force) {
      changed = true
      this.sizes.longestLineLength = longestLineLength

      this.canvas.back.width = this.canvas.text.width =
        (this.sizes.longestLineLength * this.char.width! + this.gutter.padding) * this.canvas.pixelRatio

      this.canvas.mark.width = this.canvas.text.width + this.char.px!.width / 2

      this.canvas.scroll!.width = Math.max(0, this.canvas.text.width - this.canvas.width + this.canvas.gutter.width + this.char.px!.width * 2)
    }

    if (changed) {
      this.scrollbar.area!.width = this.canvas.text.width + this.char.px!.width * 2

      this.scrollbar.area!.height = this.canvas.scroll!.height + this.page!.height!

      this.scrollbar.scale!.width = this.scrollbar.view!.width / this.scrollbar.area!.width
      this.scrollbar.scale!.height = this.scrollbar.view!.height / this.scrollbar.area!.height

      this.scrollbar.horiz = this.scrollbar.scale!.width * this.scrollbar.view!.width
      this.scrollbar.vert = this.scrollbar.scale!.height * this.scrollbar.view!.height

      this.ctx.text.scale(this.canvas.pixelRatio, this.canvas.pixelRatio)
      this.ctx.back.scale(this.canvas.pixelRatio, this.canvas.pixelRatio)

      this.canvas.title.width = this.canvas.width
      this.updateTitle()

      if (this.isSubEditor) {
        this.controlEditor.updateSizes(true)
        this.controlEditor.updateText()
      }

      return true
    }
  }

  hasKeys(keys: string) {
    return keys.split(' ').every((key: unknown) => this.keys.has(key))
  }

  getLineLength(line: number) {
    return this.buffer.getLine(line).length
  }

  alignCol(line: number) {
    return Math.min(this.caret.align, this.buffer.getLineLength(line))
  }

  applyFont(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
    ctx.textBaseline = 'top'
    ctx.font = `normal ${this.fontSize | 0}px ${this.fontAlias}`
    // ctx.imageSmoothingEnabled = false
    // ctx.imageSmoothingQuality = 'low'
  }

  updateGutter() {
    const { gutter } = this.ctx

    // this.applyFont(gutter)
    gutter.textBaseline = 'top'
    gutter.font = `normal ${this.fontSize | 0}px ${this.fontAlias}`

    gutter.fillStyle = theme.gutter
    gutter.fillRect(0, 0, this.canvas.gutter.width, this.canvas.gutter.height)
    gutter.fillStyle = theme.lineNumbers

    for (let i = 0, y = 0; i <= this.sizes.loc; i++) {
      y = this.canvas.padding + i * this.line.height! + this.char.offsetTop
      gutter.fillText((1 + i).toString().padStart(this.gutter.size!), this.canvas.padding, y)
    }
  }

  lenses: Record<number, string> = { 0: '' }
  // lenses: Record<number, string> = { 1: 'error here', 3: 'and here..' }
  setLenses = ({ lenses }: { lenses: Lens[] }) => {
    this.lenses = lenses.reduce((p, n) => {
      p[n.line] = n.message
      return p
    }, {} as Record<number, string>)
    this.updateSizes()
    this.updateMark()
    this.updateText()
    this.draw()
  }

  origMarkers: Marker[] = []
  onmarkers = ({ markers }: { markers: Marker[] }, noDraw?: boolean) => {
    this.origMarkers = markers
    this.markers = markers.map(({ index, size, color, hoverColor, kind }) => {
      const begin = this.buffer.getOffsetPoint(index)
      const end = this.buffer.getOffsetPoint(index + size)
      return Object.assign(new Area({ begin, end }), { color, hoverColor, kind })
    })
    if (!noDraw && this.isReady) {
      this.updateMark()
      this.draw()
      if (this.hoveredMarkerIndex) {
        this.emit('entermarker', {
          markerIndex: this.hoveredMarkerIndex,
          marker: this.origMarkers[this.hoveredMarkerIndex]
        })
      }
    }
  }

  updateTextSync = () => {
    if (!this.ctx) return

    const { text, back } = this.ctx

    // theme.variable = this.color

    this.applyFont(text)
    back.clearRect(0, 0, this.canvas.text.width, this.canvas.text.height)
    text.clearRect(0, 0, this.canvas.text.width, this.canvas.text.height)
    text.fillStyle = theme.text

    const code = this.buffer.toString()
    const pieces = this.syntax.highlight(code + '\n.')

    // const AnyChar = /\S/  // TODO: ???????????
    const fh = this.line!.height! + .15  //Math.ceil(this.line.height)
    let i = 0,
      x = 0,
      y = 0,
      lastNewLine = 0,
      idx = 0
    // text.fillStyle = '#000'
    // for (const line of code.split('\n')) {
    //   y = this.canvas.padding + i * this.line.height

    //   for (let sx = 1; sx <= 2; sx++) {
    //     for (let sy = 1; sy <= 2; sy ++) {
    //       // text.fillText(string, x+sx, y)
    //       // text.fillText(string, x-sx, y)
    //       text.fillText(line, x+sx, y+sy)
    //       text.fillText(line, x+sx, y-sy)

    //       // text.fillText(string, x, y+sy)
    //       // text.fillText(string, x, y-sy)
    //       text.fillText(line, x-sx, y+sy)
    //       text.fillText(line, x-sx, y-sy)
    //     }
    //   }

    //   i++
    // }

    const bgBlack = '#0000'
    // i = 0, x = 0, y = 0, lastNewLine = 0
    const queue = []
    let lens
    for (const [type, string, index] of pieces.values()) {
      y = this.canvas.padding + i * this.line.height!

      idx = index!

      if (type === 'newline') {
        back.fillStyle = bgBlack
        back.fillRect(0, y - 1.5, this.char.width! * (index! - lastNewLine), fh!)

        for (const [type, string, x, y] of queue as any) {
          const bg = (backgrounds as any)[type as any]
          if (bg) {
            back.fillStyle = bg
            back.fillRect(+x, +y - 1.5, this.char.width! * (string as string).length, fh!)
          }

          paintText(text, string, (theme as any)[type], x, y + this.char.offsetTop!)

          // // text.fillStyle = '#00f' //(theme as any)[type as any]
          // text.lineWidth = 1.95
          // text.strokeStyle = '#0008'
          // text.miterLimit = 2
          // text.lineJoin = 'round'
          // text.strokeText(string as unknown as string, x as number, (y as number) + this.char.offsetTop! + 0.8)
          // text.fillStyle = (theme as any)[type as any]
          // text.fillText(string as unknown as string, x as number, (y as number) + this.char.offsetTop!)
        }
        queue.length = 0

        lastNewLine = index! + 1

        // AnyChar.lastIndex = 0

        lens = this.lenses[i]
        if (lens) {
          text.font = `italic ${this.fontSize * 0.85 | 0}px ${this.fontAlias}`

          paintText(text, lens, '#f31',
            (this.buffer.getLineLength(i - 1) + 1.25) * this.char.width!,
            (i - 1) * this.line.height!
            + this.char.offsetTop!
            + this.canvas.padding
            // + this.char.height! * 0.05
          )

          // text.fillStyle = '#f31'
          // text.fillText(lens, (this.buffer.getLineLength(i - 1) + 1.25) * this.char.width!, (i - 1) * this.line.height! + this.char.offsetTop! + this.canvas.padding + this.char.height! * 0.05)
          text.font = `normal ${this.fontSize | 0}px ${this.fontAlias}`
        }

        i++
        continue
      }

      x = (index! - lastNewLine) * this.char.width! + this.gutter.padding

      queue.push([type, string, x, y])
      // // AnyChar.lastIndex = 0

      // text.fillStyle = 'rgba(0,0,0,.65)'
      // text.fillRect(x + (AnyChar.exec(string)?.index * this.char.width), y, this.char.width * string.trim().length, fh)

      // text.fillStyle = theme[type]
      // text.fillText(string, x, y)
    }

    // if (queue.length) {

    back.fillStyle = bgBlack
    back.fillRect(0, y - 1.5, this.char.width! * (idx - lastNewLine + (queue[queue.length - 1][1] as string)!.length) + 8, fh!)

    // text.fillRect(0, y, this.char.width * string.length + 4, fh)
    for (const [type, string, x, y] of queue.slice(0, -1) as any) {
      const bg = (backgrounds as any)[type as any]
      if (bg) {
        back.fillStyle = bg
        back.fillRect(+x, +y - 1.5, this.char.width! * (string as string).length, fh!)
      }
      paintText(text, string, (theme as any)[type], x, y)
      // text.fillStyle = (theme as any)[type]
      // text.fillText(string as unknown as string, x as number, y as number)
    }

    lens = this.lenses[i]
    if (lens) {
      text.font = `italic ${this.fontSize * 0.85 | 0}px ${this.fontAlias}`

      paintText(text, lens, '#f31',
        (this.buffer.getLineLength(i - 1) + 1.25) * this.char.width!,
        (i - 1) * this.line.height!
        + this.char.offsetTop!
        + this.canvas.padding
        // + this.char.height! * 0.05
      )

      // text.fillStyle = '#f31'
      // text.fillText(lens,
      text.font = `normal ${this.fontSize | 0}px ${this.fontAlias}`
    }
  }

  updateText = $.queue.task(this.updateTextSync)

  markers: (Area & { color?: string })[] = []

  updateMarkSync = () => {
    if (!this.ctx) return

    const { mark } = this.ctx

    const markArea = this.mark.get() as any
    markArea.color = theme.mark
    const markers = [...this.markers, ...(this.markActive && !this.mark.isEmpty() ? [markArea] : [])] as (Area & { color?: string, hoverColor?: string })[]
    const totalArea = Area.join(markers)

    this.canvas.mark.height = ((1 + totalArea.height) * this.line.height! + this.line.padding) * this.canvas.pixelRatio

    if (totalArea.isEmpty()) return

    const Y = totalArea.begin.y

    mark.scale(this.canvas.pixelRatio, this.canvas.pixelRatio)
    mark.fillStyle = theme.mark

    const xx = this.gutter.padding
    const yy = 0

    let ax = 0,
      bx = 0,
      ay = 0,
      by = 0

    const drawMarkArea = ({ begin, end }: Area, eax = 0, ebx = 0) => {
      ax = begin.x * this.char.width!
      bx = (end.x - begin.x) * this.char.width!
      ay = begin.y * this.line.height!
      by = this.line.height! + .15
      mark.fillRect(xx + ax + eax, yy + ay, bx - eax + ebx, by)
    }

    const hoveredMarker = this.markers[this.hoveredMarkerIndex]

    for (const area of markers) {
      if (area === hoveredMarker) {
        mark.fillStyle = area.hoverColor ?? theme.markHover
      } else {
        mark.fillStyle = area.color ?? theme.marker
      }

      // const area = this.mark.get()
      const { begin, end } = new Area(area).shiftByLines(-Y)

      if (begin.y === end.y) {
        const { tabs: beginTabs } = this.getPointTabs({
          x: begin.x,
          y: begin.y + Y,
        })
        const { tabs: endTabs } = this.getPointTabs({ x: end.x, y: end.y + Y })
        begin.x += beginTabs * this.tabSize - beginTabs
        end.x += endTabs * this.tabSize - endTabs
        drawMarkArea({ begin, end } as Area)
      } else {
        for (let y = begin.y; y <= end.y; y++) {
          let lineLength = this.buffer.getLineLength(y + Y)
          const { tabs } = this.getPointTabs({
            x: lineLength,
            y: y + Y,
          })
          lineLength += tabs * this.tabSize - tabs

          if (y === begin.y) {
            const { tabs } = this.getPointTabs({
              x: begin.x,
              y: begin.y + Y,
            })
            begin.x += tabs * this.tabSize - tabs
            drawMarkArea({ begin, end: { x: lineLength } } as Area, 0, this.char.width! / 2)
          } else if (y === end.y) {
            const { tabs } = this.getPointTabs({
              x: end.x,
              y: end.y + Y,
            })
            end.x += tabs * this.tabSize - tabs
            drawMarkArea({ begin: { x: 0, y }, end } as Area, -this.gutter.padding)
          } else {
            drawMarkArea({ begin: { x: 0, y }, end: { x: lineLength, y } } as Area, -this.gutter.padding, this.char.width! / 2)
          }
        }
      }
    }

    this.emit('selection', {
      text: this.buffer.getAreaText(this.mark.get()),
    })
  }

  updateMark = $.queue.task(this.updateMarkSync)

  updateTitle() {
    if (!this.ctx) return
    this.ctx.title.save()
    this.ctx.title.fillStyle = theme.titlebar
    this.ctx.title.fillRect(0, 0, this.canvas.title.width, this.canvas.title.height)
    this.applyFont(this.ctx.title)
    this.ctx.title.font = `normal 9pt ${this.fontAlias}` // TODO: title font size
    // this.ctx.title.textAlign = `center`
    this.ctx.title.scale(this.canvas.pixelRatio, this.canvas.pixelRatio)
    this.ctx.title.fillStyle = theme.title
    this.ctx.title.fillText(
      (this.extraTitle ?? '') + this.title,
      this.titlebar.dir
        ? this.canvas.title.width / this.canvas.pixelRatio - 2 - (this.char.px!.width / this.canvas.pixelRatio) * this.title.length
        : 7.5, // 39,
      7.5 //5.4
    )
    this.ctx.title.restore()
  }

  setOffsetTop(offsetTop: number, realOffsetTop: number) {
    this.offsetTop = offsetTop
    this.realOffsetTop = realOffsetTop

    this.isVisible =
      !this.isSubEditor ||
      (this.offsetTop + this.scroll.pos.y < this.canvas.height &&
        this.offsetTop + this.scroll.pos.y + this.canvas.gutter.height + this.titlebar.height > 0)
  }

  clear() {
    // clear
    // this.ctx.outer.fillStyle = 'transparent' //theme.background
    // this.ctx.outer.fillRect(
    //   0,
    //   0,
    //   this.canvas.width,
    //   this.canvas.height
    // )
    Object.assign(this.canvas.outer, {
      width: this.canvas.width,
      height: this.canvas.height,
    })
    // this.canvas.outer.width = this.canvas.width
    // this.canvas.outer.height = this.canvas.height

    // this.ctx.outer.clearRect(
    //   0,
    //   0,
    //   this.canvas.width,
    //   this.canvas.height
    // )
  }

  drawTitle() {
    if (this.titlebar.height === 0) return
    // this.ctx.outer.save()
    this.ctx.outer.fillStyle = theme.titlebar

    // this.ctx.outer.drawImage(
    //   this.canvas.title,
    //   0,
    //   Math.max(0, this.offsetTop)
    //   // this.canvas.width,
    //   // this.titlebar.height
    // )
    // this.applyFont(this.ctx.outer)
    // this.ctx.outer.scale(this.canvas.pixelRatio, this.canvas.pixelRatio)
    // this.ctx.outer.fillStyle = theme.title
    // this.ctx.outer.fillText(
    //   this.title,
    //   5,
    //   2.5 + Math.max(0, this.offsetTop / this.canvas.pixelRatio)
    // )
    // this.ctx.outer.restore()
  }

  drawBack() {
    if (!this.canvas.back.height || !this.canvas.back.width) return
    // draw back layer

    const clipTop = Math.max(0, -this.offsetTop)

    this.ctx.outer.drawImage(
      this.canvas.back,

      this.scroll.pos.x, // sx
      this.scroll.pos.y + clipTop, // - this.offsetTop, // - this.offsetTop, // sy
      this.view.width, // sw
      this.view.height - this.offsetTop - clipTop, // sh

      this.view.left, // dx
      Math.max(0, this.view.top + this.offsetTop + clipTop), // dy
      this.view.width, // dw
      this.view.height - this.offsetTop - clipTop // dh
    )
  }

  drawText() {
    if (!this.canvas.text.height || !this.canvas.text.width) return
    // draw text layer

    const clipTop = Math.max(0, -this.offsetTop)

    this.ctx.outer.drawImage(
      this.canvas.text,

      this.scroll.pos.x, // sx
      this.scroll.pos.y + clipTop, // - this.offsetTop, // - this.offsetTop, // sy
      this.view.width, // sw
      this.view.height - this.offsetTop - clipTop, // sh

      this.view.left, // dx
      Math.max(0, this.view.top + this.offsetTop + clipTop), // dy
      this.view.width, // dw
      this.view.height - this.offsetTop - clipTop // dh
    )
  }

  drawGutter() {
    return
    // draw gutter layer

    const clipTop = Math.max(0, -this.offsetTop)

    this.ctx.outer.drawImage(
      this.canvas.gutter,

      0, // sx
      this.scroll.pos.y + clipTop, // sy
      this.canvas.gutter.width, // sw
      this.view.height - this.offsetTop - clipTop, // sh

      0, // dx
      Math.max(0, this.view.top + this.offsetTop + clipTop), // dy
      this.canvas.gutter.width, // dw
      this.view.height - this.offsetTop - clipTop // dh
    )
  }

  drawMark() {
    // draw mark layer
    const markers = [...this.markers, ...(this.markActive && !this.mark.isEmpty() ? [this.mark.get()] : [])]
    const totalArea = Area.join(markers)

    if (totalArea.isEmpty()) return

    const { begin } = totalArea

    const y = begin.y * this.char.px!.height

    const clipTop = Math.max(0, -(y + this.offsetTop - this.scroll.pos.y + this.canvas.padding * this.canvas.pixelRatio))

    const posTop = -this.scroll.pos.y + this.offsetTop + y + clipTop + this.titlebar.height + this.canvas.padding * this.canvas.pixelRatio

    const height = this.canvas.mark.height - clipTop

    // this.controlEditor.ctx.debug.clearRect(0, 0, this.canvas.width, this.canvas.height)
    // this.controlEditor.ctx.debug.fillStyle = 'rgba(255,0,0,.5)'
    // this.controlEditor.ctx.debug.fillRect(0, posTop, 10, height)

    this.ctx.outer.drawImage(
      this.canvas.mark,

      this.scroll.pos.x, // sx
      clipTop, // sy
      this.canvas.mark.width, // sw
      height, // sh

      this.canvas.gutter.width, // dx
      posTop - 3, // dy
      this.canvas.mark.width, // dw
      height // dh
    )
  }

  drawCaret() {
    // draw caret
    this.ctx.outer.fillStyle = theme.caret

    this.ctx.outer.fillRect(
      -this.scroll.pos.x + (this.caret.px.x + this.gutter.width + this.canvas.padding) * this.canvas.pixelRatio - 1, // dx

      -this.scroll.pos.y + this.caret.px.y * this.canvas.pixelRatio + this.titlebar.height + this.offsetTop + 4, // dy
      this.caret.width * this.canvas.pixelRatio, // dw
      this.caret.height * this.canvas.pixelRatio // dh
    )
  }

  drawBlock() {
    // draw block highlight
    this.ctx.outer.fillStyle = '#fff' //theme.caret

    if (this.block.isEmpty()) return

    this.ctx.outer.fillRect(
      -this.scroll.pos.x + (this.block.begin.x + this.gutter.width + this.canvas.padding) * this.canvas.pixelRatio + this.char.px!.width * 0.08,

      -this.scroll.pos.y + this.block.begin.y * this.canvas.pixelRatio + this.titlebar.height + this.offsetTop + this.char.px!.height * 1.1, // dy

      this.char.px!.width * 0.84, // dw
      2 // dh
    )

    this.ctx.outer.fillRect(
      -this.scroll.pos.x + (this.block.end.x + this.gutter.width + this.canvas.padding) * this.canvas.pixelRatio + this.char.px!.width * 0.08,

      -this.scroll.pos.y + this.block.end.y * this.canvas.pixelRatio + this.titlebar.height + this.offsetTop + this.char.px!.height * 1.1, // dy

      this.char.px!.width * 0.84, // dw
      2 // dh
    )
  }

  drawVertScrollbar() {
    this.ctx.outer.strokeStyle = theme.scrollbar
    this.ctx.outer.lineWidth = this.scrollbar.width
    this.ctx.outer.lineCap = 'round'

    const y =
      (this.scroll.pos.y / (this.canvas.text.height + this.subEditorsHeight - this.canvas.height || 1)) *
      (this.scrollbar.view!.height - this.scrollbar.vert! || 1)

    // this makes the scrollbar disappear when there is no vertical
    // scrolling left, but keeping the scrollbar visible doubles as a focus
    // indicator, so it's commented out. TODO: make configurable
    // if ((this.scrollbar.scale!.height >= 1 && y > 2) || this.scrollbar.scale!.height < 1) {
    this.ctx.outer.beginPath()
    this.ctx.outer.moveTo(this.canvas.width - this.scrollbar.margin!, y + this.scrollbar.margin!)
    this.ctx.outer.lineTo(this.canvas.width - this.scrollbar.margin!, y + this.scrollbar.vert! - 30 - this.scrollbar.margin!)
    this.ctx.outer.stroke()
    // }
  }

  drawHorizScrollbar() {
    this.ctx.outer.strokeStyle = theme.scrollbar
    this.ctx.outer.lineWidth = this.scrollbar.width

    const x = (this.scroll.pos.x / (this.canvas.scroll!.width || 1)) * (this.scrollbar.view!.width - this.scrollbar.horiz! || 1) || 0

    const y = Math.min(
      this.canvas.gutter.height + this.offsetTop - this.scroll.pos.y + this.titlebar.height - this.scrollbar.margin!,

      this.canvas.height - this.scrollbar.margin!
    )

    if (
      y > this.titlebar.height - this.scrollbar.width + this.scrollbar.margin! &&
      this.offsetTop + this.titlebar.height < this.canvas.height &&
      x + this.scrollbar.view!.width - this.scrollbar.horiz! > 12
    ) {
      this.ctx.outer.beginPath()
      this.ctx.outer.moveTo(this.canvas.gutter.width + x + this.scrollbar.margin!, y)
      this.ctx.outer.lineTo(this.canvas.gutter.width + x + this.scrollbar.horiz! + 1 - this.scrollbar.margin! * 2, y)
      this.ctx.outer.stroke()
    }
  }

  drawSync(noDelegate = false) {
    if (!this.isReady) return
    if (this.isSubEditor && !noDelegate) {
      this.controlEditor.drawSync()
      return
    }
    if (!this.isSubEditor) this.setOffsetTop(0, 0)
    let offsetTop = -this.scroll.pos.y + this.canvas.gutter.height + this.titlebar.height
    let realOffsetTop = this.canvas.gutter.height + this.titlebar.height
    this.subEditors.forEach(editor => {
      editor.setOffsetTop(offsetTop, realOffsetTop)
      offsetTop += editor.canvas.gutter.height + editor.titlebar.height
      realOffsetTop += editor.canvas.gutter.height + editor.titlebar.height
    })
    if (!this.isSubEditor) {
      this.clear()
    }
    this.drawBack()
    // if (this.markActive)
    this.drawMark()
    if (this.controlEditor.focusedEditor === this && this.hasFocus) {
      this.drawCaret()
      this.drawBlock()
    }
    if (!this.isSubEditor && this.isVisible) this.drawTitle()
    this.subEditors.forEach(editor => editor.isVisible && editor.drawTitle())
    this.drawText()
    this.drawGutter()
    this.subEditors.forEach(editor => editor.isVisible && editor.drawSync(true))
    if (!this.isSubEditor && this.hasFocus) {
      this.drawVertScrollbar()
      this.drawHorizScrollbar()
      this.subEditors.forEach(editor => editor.isVisible && editor.drawHorizScrollbar())
    }

    if (!this.isSubEditor) {
      // this.ctx.outer.drawImage(
      //   this.canvas.debug,
      //   0,
      //   0
      //   // this.c
      // )
      this.emit('draw')
    }
  }

  draw = $.queue.raf(() => {
    if (this.isSubEditor) {
      this.controlEditor.draw()
    } else {
      this.drawSync()
      // cancelAnimationFrame(this.drawAnimFrame as any)
      // this.drawAnimFrame = requestAnimationFrame(this.drawSync as any) as any
    }
  })

  drawAnimFrame(_drawAnimFrame: any) {
    throw new Error('Method not implemented.')
  }

  scrollTo(pos: Point | PointLike) {
    this.animScrollCancel()
    this.scroll.pos.set(Point.clamp(this.canvas.scroll! as any, pos))
    this.scroll.target.set(this.scroll.pos)
    this.drawSync()
  }

  scrollBy(d: PointLike, animType?: AnimType, clamp = false) {
    const target = Point.clamp(
      clamp
        ? ({
          begin: {
            x: 0,
            y: this.controlEditor.focusedEditor!.realOffsetTop,
          },
          end: {
            x: this.canvas.scroll!.width,
            y:
              this.controlEditor.focusedEditor!.realOffsetTop
              + this.controlEditor.focusedEditor!.canvas.text!.height
            // - this.page!.height!
            // -
            // this.view!.height +
            // this.titlebar!.height,
          },
        } as Area)
        : (this.canvas.scroll as any), // TODO: ??????????????
      this.scroll.pos.add(d)
    )

    if (this.scroll.target.equal(target)) return false

    this.scroll.target.set(target)
    if (!animType) {
      this.scrollTo(this.scroll.target)
    } else {
      this.animScrollStart(animType)
    }

    return true
  }

  animScrollCancel() {
    this.scrollAnim.isRunning = false
    cancelAnimationFrame(this.scrollAnim.animFrame as any)
  }

  animScrollStart(animType: AnimType = 'ease') {
    this.scrollAnim.type = animType
    if (this.scrollAnim.isRunning) return

    this.scrollAnim.isRunning = true
    this.scrollAnim.animFrame = requestAnimationFrame(this.animScrollTick) as any

    const s = this.scroll.pos
    const t = this.scroll.target
    if (s.equal(t)) return this.animScrollCancel()

    const d = t.minus(s)

    d.x = Math.sign(d.x) * 5
    d.y = Math.sign(d.y) * 5

    this.scroll.pos.set(Point.clamp(this.canvas.scroll as any, this.scroll.pos.add(d))) // TODO: ????
    this.drawSync()
  }

  animScrollTick() {
    // TODO: branchless
    const { scale, threshold } = this.scrollAnim
    let { speed } = this.scrollAnim
    const d = this.scroll.target.minus(this.scroll.pos)
    const a = d.abs()

    if (a.y > this.canvas.height! * threshold!.far) {
      speed! *= scale!.far
    }

    if (a.x < 0.5 && a.y < 0.5) {
      this.scrollTo(this.scroll.target)
    } else if (this.scroll.pos.equal(this.scroll.target)) {
      this.animScrollCancel()
    } else {
      this.scrollAnim.animFrame = requestAnimationFrame(this.animScrollTick) as any
      switch (this.scrollAnim.type) {
        case 'linear':
          if (a.x < speed! * threshold!.mid)
            d.x = d.x * (a.x < speed! * threshold!.near ? (a.x < threshold!.tiny ? scale!.tiny : scale!.near) : scale!.mid)
          else d.x = Math.sign(d.x!) * speed!

          if (a.y < speed! * threshold!.mid)
            d.y = d.y * (a.y < speed! * threshold!.near ? (a.y < threshold!.tiny ? scale!.tiny : scale!.near) : scale!.mid)
          else d.y = Math.sign(d.y!) * speed!
          break

        case 'ease':
          d.x *= 0.26
          d.y *= 0.26
          // console.log('yes ease')
          // d.x = Math[d.x > 0 ? 'min' : 'max'](d.x, Math.sign(d.x) * 90)
          // d.y = Math[d.y > 0 ? 'min' : 'max'](d.y, Math.sign(d.y) * 90)
          break
      }

      this.scroll.pos.set(Point.clamp(this.canvas.scroll! as any, this.scroll.pos.add(d))) // TODO: !!!!!
      this.drawSync()
    }
  }

  maybeDelegateMouseEvent(eventName: string, e: { clientY: number }) {
    if (this.isSubEditor) return false

    for (const editor of this.subEditors.values()) {
      if (
        e.clientY * this.canvas.pixelRatio > editor.offsetTop &&
        e.clientY * this.canvas.pixelRatio < editor.offsetTop + editor.canvas.gutter.height + editor.titlebar.height
      ) {
        if (eventName === 'onmousedown') {
          this.controlEditor.setFocusedEditor(editor)
        }
        ; (editor as any)[eventName](e)
        return true
      }
    }

    if (eventName !== 'onmousewheel' && this.controlEditor.focusedEditor !== this) {
      this.controlEditor.setFocusedEditor(this)
    }

    return false
  }

  maybeDelegateEvent(eventName: string, e: { text: any }) {
    if (this.isSubEditor) return false

    if (this.focusedEditor && this.focusedEditor !== this) {
      ; (this.focusedEditor as any)?.[eventName](e)
      return true
    }

    return false
  }

  oncontextmenu() {
    /**/
  }
  onmouseenter() {
    /**/
  }
  onmouseover() {
    /**/
  }
  onmouseout() {
    /**/
  }

  onmousewheel(e: { deltaX: any; deltaY: any, cmdKey: boolean }) {
    let { deltaX, deltaY } = e
    if (e.cmdKey) {
      let fontSize = this.fontSize
      fontSize += Math.sign(deltaY) * 0.25
      fontSize = +Math.max(1, fontSize).toFixed(2)
      this.fontSize = fontSize
      this.updateChar()
      this.updateText()
      this.updateSizes(true)
      this.updateMark()
      this.moveCaret(this.caret.pos)

      this.controlEditor.draw()
      this.emit('fontsize', { fontSize })
      // this.postMessage({ call: 'onfontsize', fontSize })

      return
    }
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (!this.maybeDelegateMouseEvent('onmousewheel', e as any)) {
        deltaX *= 0.75
        return this.scrollBy({ x: deltaX, y: 0 }, 'linear')
      }
    } else {
      deltaY *= 0.75
      return this.scrollBy({ x: 0, y: deltaY }, 'linear')
    }
  }

  onmouseup() {
    // onmousedown has done .markBegin() so we check
    // if nothing was marked then clear/end mark
    if (this.mark.isEmpty()) this.markClear()
  }

  onmousedown(e: { left?: any; right?: any; clientX?: any; clientY?: any }) {
    if (!this.maybeDelegateMouseEvent('onmousedown', e as any)) {
      this.usedMouseRight = false
      if (e.left) {
        this.maybeHoverMarkerByEvent(e)
        this.markClear()
        this.updateMark()
        this.setCaretByMouse(e as any)
        this.markBegin()
        this.draw()
      } else if (e.right) {
        // this prevents clicking away from context menu
        // to create a selection
        this.usedMouseRight = true
      }
    }
  }

  hoveredMarkerIndex = -1

  maybeHoverMarkerByEvent(e: { left?: any; clientX?: any; clientY?: any }) {
    // hover markers
    if (e.clientX == null || e.clientY == null) return
    const pos = this.getPointByMouse(e as any, true)
    const { offset } = this.buffer.getPoint(pos)
    let i = this.origMarkers.length
    for (; i--;) {
      const marker = this.origMarkers[i]
      const { index, size, kind } = marker
      if (kind !== 'param' && kind !== 'error') continue

      if (offset >= index && offset < index + size) {
        if (this.hoveredMarkerIndex !== i) {
          this.hoveredMarkerIndex = i
          this.updateMark()
          this.draw()
          this.emit('entermarker', {
            markerIndex: i,
            marker
          })
        }
        return
      }
    }
    this.leaveMarker()
  }

  leaveMarker() {
    if (this.hoveredMarkerIndex !== -1) {
      const i = this.hoveredMarkerIndex
      this.hoveredMarkerIndex = -1
      this.updateMark()
      this.draw()
      this.emit('leavemarker', {
        markerIndex: i,
        marker: this.origMarkers[i]
      })
    }
  }

  onmousemove(e: { left?: any; clientX: any; clientY: any }) {
    if (!this.maybeDelegateEvent('onmousemove', e as any)) {
      if (!this.usedMouseRight) {
        if (e.left) {
          this.setCaretByMouse(e as any)
          this.markSet()
          // if (!this.keepCaretInView()) {
          this.drawSync()
          // }
        } else {
          this.maybeHoverMarkerByEvent(e)
        }
      }
    }
  }

  keepCaretInView(animType?: 'ease' | false, centered?: boolean, clamp?: boolean) {
    const caretPxDiff = this.getCaretPxDiff(centered)
    if (this.controlEditor === this) {
      this.scrollBy({ x: -caretPxDiff.x, y: -caretPxDiff.y }, animType, clamp)
    } else {
      if (caretPxDiff.x !== 0) this.scrollBy({ x: -caretPxDiff.x, y: 0 }, animType)
      if (caretPxDiff.y !== 0) this.controlEditor.scrollBy({ x: 0, y: -caretPxDiff.y }, animType, clamp)
    }
  }

  applyCaretDiff(diff: PointLike | undefined, jump = false) {
    const diffPx = new Point(diff).mul(this.char.px!)
    const caretPxDiff = this.getCaretPxDiff()
    if (caretPxDiff.x !== 0) this.scrollBy({ x: -caretPxDiff.x, y: 0 })
    if (caretPxDiff.y !== 0) {
      if (jump) {
        this.controlEditor.scrollBy({ x: 0, y: -(diffPx.y || caretPxDiff.y) }, 'ease', true)
      } else {
        this.controlEditor.scrollBy({ x: 0, y: -caretPxDiff.y }, 'ease')
      }
    }
  }

  onkeydown(e: { key: unknown; which: unknown; char: unknown; cmdKey: any; shiftKey: any; altKey: any }) {
    if (this.maybeDelegateEvent('onkeydown', e as any)) return

    this.keys.delete((e.key as string).toLowerCase())
    this.keys.delete((e.key as string).toUpperCase())
    this.keys.add(e.key)
    this.keys.add(e.which)
    this.keys.add(e.char)
    this.key = (e.key as string).length === 1 ? (e.key as string) : null

    if (!e.cmdKey && this.key) return this.insert(this.key)
    if (!e.cmdKey && e.key === 'Enter') return this.insert('\n')
    if (!e.cmdKey && e.key === 'Backspace') return this.backspace()
    if (!e.cmdKey && !e.shiftKey && e.key === 'Delete') return this.delete()

    this.pressed = [e.cmdKey && 'Cmd', e.altKey && 'Alt', e.key].filter(Boolean).join(' ')

    // navigation
    if (e.shiftKey && e.key !== 'Shift') this.markBegin()
    else if (e.key !== 'Delete' && !e.cmdKey && e.key !== 'Tab') {
      this.markClear()
      this.updateMark()
    }

    switch (this.pressed) {
      case 'Cmd z':
        {
          if (this.readableOnly) break

          const editor = this.controlEditor.history.undo(this.controlEditor.history.needle - 1)
          if (editor) this.setFocusedEditor(editor)
          this.draw()
        }
        break
      case 'Cmd y':
        {
          if (this.readableOnly) break

          const editor = this.controlEditor.history.redo(this.controlEditor.history.needle + 1)
          if (editor) this.setFocusedEditor(editor)
          this.draw()
        }
        break
      case 'Tab':
        {
          if (this.readableOnly) break

          const tab = ' '.repeat(this.tabSize)

          let add
          let area
          let text

          const prevArea = this.mark.copy()

          const clear = false
          const caret = this.caret.pos.copy()
          const align = this.caret.align

          let matchIndent = false

          if (!this.markActive) {
            this.insert(tab)
            break
          } else {
            area = this.mark.get()
            area.end.y += area.end.x > 0 ? 1 : 0
            area.begin.x = 0
            area.end.x = 0
            text = this.buffer.getAreaText(area)
            matchIndent = true
          }

          if (e.shiftKey) {
            add = -2
            text = text.replace(/^ {1,2}(.+)/gm, '$1') // TODO: use tabSize
          } else {
            add = +2
            text = text.replace(/^([\s]*)(.+)/gm, `$1${tab}$2`)
          }

          this.mark.set(area)
          this.insert(text)
          this.mark.set(prevArea)
          this.mark.begin.x += this.mark.begin.x > 0 ? add : 0
          this.mark.end.x += this.mark.end.x > 0 ? add : 0
          this.markActive = !clear

          this.caret.align = align

          if (matchIndent) {
            caret.x += add
            this.caret.align += add
          }
          this.setCaret(caret)
          this.updateMark()
          this.draw()
        }
        break
      case 'Cmd ,':
      case 'Cmd ?': {
        if (!this.markActive || e.key === '?') {
          let y = this.caret.pos.y
          while (y > 0 && this.buffer.getLineLength(y) > 0) y--
          const startY = ++y
          y = this.caret.pos.y
          while (y <= this.sizes.loc && this.buffer.getLineLength(y) > 0) y++
          const endY = --y
          this.mark.set({
            begin: { x: 0, y: startY },
            end: { x: this.buffer.getLineLength(endY), y: endY },
          } as Area)
          this.markActive = true
          this.updateMark()
          this.draw()
          if (e.key !== ',') {
            break
          }
        }
      }
      // break
      // eslint-disable-next-line no-fallthrough
      case 'Cmd /':
        {
          if (this.readableOnly) break

          let add
          let area
          let text

          const prevArea = this.mark.copy()

          let clear = false
          const caret = this.caret.pos.copy()
          const align = this.caret.align

          const matchIndent = true

          if (!this.markActive) {
            clear = true
            this.markClear()
            this.moveBeginOfLine()
            this.markBegin()
            this.moveEndOfLine()
            this.markSet()
            area = this.mark.get()
            text = this.buffer.getAreaText(area)
            // matchIndent = (text.match(/\S/)?.index as unknown as number) <= caret.x
          } else {
            area = this.mark.get()
            if (area.end.x > 0) {
              area.end.x = this.buffer.getLineLength(area.end.y)
            } else {
              area.end.y--
              area.end.x = this.buffer.getLineLength(area.end.y)
            }
            area.begin.x = 0
            text = this.buffer.getAreaText(area)
            // matchIndent = true
          }


          if (text.trimStart().startsWith(this.singleComment!)) {
            add = -(this.singleComment!.length + 1)
            text = text.replace(this.singleCommentRegExp!, '$1')
          } else {
            add = +(this.singleComment!.length + 1)
            text = text.replace(/^(\s+)?/gm, `${this.singleComment!} $1`)
          }

          this.mark.set(area)
          this.saveHistory(true)
          this.insert(text, false, false)
          this.mark.set(prevArea)
          this.saveHistory(true)
          this.mark.begin.x += this.mark.begin.x > 0 ? add : 0
          this.mark.end.x += this.mark.end.x > 0 ? add : 0
          this.markActive = !clear

          this.caret.align = align

          if (matchIndent) {
            caret.x += add
            this.caret.align += add
          }
          this.setCaret(caret)
          this.updateMark()
          this.keepCaretInView()
          this.draw()
          if (e.key === ',') {
            this.emit('blockcomment')
          }
        }
        return
      case 'Cmd D':
        {
          if (this.readableOnly) break
          this.align()
          const area = this.mark.get()
          if (area.isEmpty()) {
            this.buffer.insert(
              new Point({ x: 0, y: this.caret.pos.y }),
              this.buffer.getLineText(this.caret.pos.y) + (this.caret.pos.y === this.buffer.loc() ? '\n' : '')
            )
            this.updateSizes()
            this.updateText()
            this.moveByLines(+1)
            this.markClear(true)
          } else if (area.begin.y === area.end.y) {
            const text = this.buffer.getAreaText(area)
            this.buffer.insert(this.caret.pos, text)
            this.updateSizes()
            this.updateText()
            this.moveByChars(text.length)
            this.mark.addRight(text.length)
            this.updateMark()
          } else {
            let text = ''
            let addY = 0
            if (area.end.x > 0) {
              addY = 1
              text = '\n'
              area.end.x = this.buffer.getLineLength(area.end.y)
            }
            area.begin.x = 0
            text = text + this.buffer.getAreaText(area)
            this.buffer.insert(area.end, text)
            area.end.y += addY
            this.updateSizes()
            this.updateText()
            this.moveByLines(area.height)
            this.mark.shiftByLines(area.height)
            this.updateMark()
          }
          this.keepCaretInView('ease')
          this.draw()
        }
        return

      case 'Delete':
      case 'Cmd x':
        if (!this.mark.isEmpty()) {
          this.delete()
        } else {
          this.markClear(true)
          this.moveBeginOfLine()
          this.markBegin()
          const diff = this.caret.pos.y === this.sizes.loc
            ? this.moveEndOfLine()
            : this.moveByLines(+1)
          // only delete content below
          if ((diff.y !== 0 || diff.x !== 0)) {
            this.markSet()
            this.delete()
          } else {
            this.markClear(true)
          }
        }
        break
      case 'Cmd a':
        this.markClear(true)
        this.moveBeginOfFile()
        this.markBegin()
        this.moveEndOfFile()
        this.markSet()
        break
      case 'Cmd Backspace':
        this.markBegin()
        e.shiftKey ? this.moveBeginOfLine() : this.moveByWords(-1)
        this.markSet(true)
        this.delete()
        break
      case 'Cmd Delete':
        this.markBegin()
        e.shiftKey ? this.moveEndOfLine() : this.moveByWords(+1)
        this.markSet(true)
        this.delete()
        this.align()
        break
      case 'Cmd ArrowLeft':
        this.moveByWords(-1)
        if (e.shiftKey) this.markSet()
        this.align()
        break
      case 'Cmd ArrowRight':
        this.moveByWords(+1)
        if (e.shiftKey) this.markSet()
        this.align()
        break
      case 'Cmd ArrowUp':
        if (e.shiftKey) {
          if (this.readableOnly) break
          this.align()
          this.markBegin(false)
          const area = this.mark.get()
          if (!area.isEmpty() && area.end.x === 0) {
            area.end.y = area.end.y - 1
            area.end.x = this.buffer.getLine(area.end.y).length
          }
          if (this.buffer.moveAreaByLines(-1, area)) {
            this.updateSizes()
            this.updateText()
            this.mark.shiftByLines(-1)
            this.applyCaretDiff(this.moveByLines(-1))
            this.updateMark()
          }
        } else {
          this.scrollBy({ x: 0, y: -this.char.px!.height }, 'ease')
        }
        break
      case 'Cmd ArrowDown':
        if (e.shiftKey) {
          if (this.readableOnly) break
          this.align()
          this.markBegin(false)
          const area = this.mark.get()
          if (!area.isEmpty() && area.end.x === 0) {
            area.end.y = area.end.y - 1
            area.end.x = this.buffer.getLine(area.end.y).length
          }
          if (this.buffer.moveAreaByLines(+1, area)) {
            this.updateSizes()
            this.updateText()
            this.mark.shiftByLines(+1)
            this.applyCaretDiff(this.moveByLines(+1))
            this.updateMark()
          }
        } else {
          this.scrollBy({ x: 0, y: +this.char.px!.height }, 'ease')
        }
        break

      case 'ArrowLeft':
        this.applyCaretDiff(this.moveByChars(-1))
        if (e.shiftKey) this.markSet()
        break
      case 'ArrowRight':
        this.applyCaretDiff(this.moveByChars(+1))
        if (e.shiftKey) this.markSet()
        break
      case 'ArrowUp':
        this.applyCaretDiff(this.moveByLines(-1))
        if (e.shiftKey) this.markSet()
        break
      case 'ArrowDown':
        this.applyCaretDiff(this.moveByLines(+1))
        if (e.shiftKey) this.markSet()
        break

      case 'Alt PageUp':
        this.controlEditor.moveByEditors(-1)
        break
      case 'Alt PageDown':
        this.controlEditor.moveByEditors(+1)
        break

      case 'PageUp':
        {
          const caretPos = this.caret.pos.copy()
          this.applyCaretDiff(this.moveByLines(-this.page.lines!), true)
          if (e.shiftKey) this.markSet()
          else {
            if (caretPos.equal(this.caret.pos)) {
              this.controlEditor.moveByEditors(-1)
            }
          }
        }
        break
      case 'PageDown':
        {
          const caretPos = this.caret.pos.copy()
          this.applyCaretDiff(this.moveByLines(+this.page.lines!), true)
          if (e.shiftKey) this.markSet()
          else {
            if (caretPos.equal(this.caret.pos)) {
              this.controlEditor.moveByEditors(+1)
            }
          }
        }
        break

      case 'Home':
        this.applyCaretDiff(this.moveBeginOfLine({ isHomeKey: true }))
        if (e.shiftKey) this.markSet()
        break
      case 'End':
        this.applyCaretDiff(this.moveEndOfLine())
        if (e.shiftKey) this.markSet()
        break
    }

    this.draw()
  }

  moveByEditors(y: number) {
    const editors = [this, ...this.subEditors]
    let index = editors.indexOf(this.focusedEditor!)
    const prev = index
    index += y
    if (index > editors.length - 1) index = 0
    if (index < 0) index = editors.length - 1
    if (prev === index) return
    const editor = editors[index]
    if (y > 0) editor.setCaret({ x: 0, y: 0 })
    else editor.setCaret({ x: 0, y: editor.sizes.loc })
    // else editor.setCaret({ x:editor.buffer.getLineLength(editor.sizes.loc), y:editor.sizes.loc })
    this.setFocusedEditor(editor)
  }

  onkeyup(e: { key: unknown; which: unknown; char: unknown }) {
    if (this.maybeDelegateEvent('onkeyup', e as any)) return

    this.keys.delete((e.key as string).toLowerCase())
    this.keys.delete((e.key as string).toUpperCase())
    this.keys.delete(e.key)
    this.keys.delete(e.which)
    this.keys.delete(e.char)
    if (e.key === this.key) {
      this.key = null
    }
  }

  onpaste({ text }: { text: string }) {
    if (this.maybeDelegateEvent('onpaste', { text })) return
    this.insert(text, true)
  }

  onhistory({ needle }: { needle: number }) {
    if (needle !== this.history.needle) {
      let editor
      if (needle < this.history.needle) {
        editor = this.history.undo(needle)
      } else if (needle > this.history.needle) {
        editor = this.history.redo(needle)
      }
      if (editor) {
        this.setFocusedEditor(editor)
      }
    }
  }

  setFocusedEditor(editor: Editor) {//, animType: 'ease' | false = 'ease', centered = true) {
    const hasFocus = this.focusedEditor?.hasFocus
    if (editor !== this.focusedEditor) {
      this.focusedEditor?.onblur()
      this.focusedEditor = editor
      if (hasFocus) {
        this.emit('focus', {
          id: editor.id,
        })
      }
    }

    // if (hasFocus) {
    editor.onfocus()
    // }
    editor.updateSizes()
    editor.updateText()
    editor.updateMark()

    // if (animType !== false) editor.keepCaretInView(false, centered, true)

    editor.draw()
  }

  onblur() {
    if (this.controlEditor.focusedEditor) {
      this.controlEditor.focusedEditor.hoveredMarkerIndex = -1
      this.controlEditor.focusedEditor.updateMark()
      this.controlEditor.focusedEditor.hasFocus = false
      this.controlEditor.focusedEditor.keys.clear()
      this.controlEditor.focusedEditor = null
    }
    this.controlEditor.draw()
  }

  onfocus() {
    if (this.controlEditor.focusedEditor) {
      this.controlEditor.focusedEditor.hasFocus = true
      this.controlEditor.focusedEditor.keys.clear()
    } else {
      this.controlEditor.focusedEditor = this
      this.controlEditor.hasFocus = true
    }
    this.emit('focus', {
      id: this.controlEditor.focusedEditor.id,
    })
    this.controlEditor.draw()
  }

  onresize = $.queue.raf(({ width, height }: Box) => {
    const set = (c: OffscreenCanvas | HTMLCanvasElement | Box) => {
      if (!c) return
      c.width = width
      c.height = height
    }

    if (!this.canvas) return

    // this.canvas.width = this.canvas.outer.width = width
    // this.canvas.height = this.canvas.outer.height = height
    set(this.canvas)
    set(this.canvas.outer)
    set(this.canvas.gutter)
    set(this.canvas.title)
    set(this.canvas.mark)
    set(this.canvas.back)
    set(this.canvas.text)
    set(this.canvas.debug)
    set(this.canvas.scroll!)

    // this.subEditors.forEach(editor => {
    //   set(editor.canvas.outer)
    //   set(editor.canvas)
    //   editor.updateSizes(true)
    //   editor.updateText()
    //   editor.updateMark()
    //   editor.drawSync(true)
    // })
    this.updateChar()
    this.updateSizes(true)
    this.updateTextSync()
    this.updateMarkSync()
    this.drawSync()
    // TODO: this needed?
    // postMessage({ call: 'onresize' })
  })

  replaceChunk = ({ start, end, text, code, markers }: { start: number, end: number, text: string, code: string, markers?: Marker[] }) => {
    const own = this.buffer.toString()
    if (code !== own) {
      throw new Error(`Attempt to replace chunk but own buffer has diverged.

Own buffer:
-----------
"${own}"

Other buffer:
"${code}"

Attempt to replace chunk:

"${own.slice(start, end)}" with "${text}"

at position: ${start}-${end}
`)
    }
    const sp = this.buffer.getOffsetPoint(start)
    const ep = this.buffer.getOffsetPoint(end)
    const prev = this.caret.pos.copy()
    this.markClear()
    this.moveCaret(sp)
    this.markBegin()
    this.moveCaret(ep)
    this.markSet(false, true)
    this.insert(text, true, false, false, true)
    this.moveCaret(prev)
    this.markClear()

    if (markers) {
      queueMicrotask(() => {
        this.onmarkers({ markers })
      })
    }

  }

  setValue = ({ value, clearHistory, scrollToTop }: { value: string, clearHistory?: boolean, scrollToTop?: boolean }) => {
    if (value !== this.buffer.toString()) {
      const readableOnly = this.readableOnly
      this.readableOnly = false
      const prev = this.caret.pos.copy()
      this.markClear()
      this.moveBeginOfFile()
      this.markBegin()
      this.moveEndOfFile()
      this.markSet()
      this.insert(value, true, false)
      this.moveCaret(prev)
      this.markClear()
      if (clearHistory) {
        this.clearHistory()
      }
      if (scrollToTop) {
        this.scrollTo({ x: 0, y: 0 })
        this.setCaret({ x: 0, y: 0 })
      }
      this.readableOnly = readableOnly
      // this.history.save()
    }
  }

  readableOnly = false
  setReadableOnly = (readableOnly: boolean) => {
    this.readableOnly = readableOnly
  }
}

if (isWorker) {
  const editor = new Editor()
  onmessage = ({ data }) => {
    if (!(data.call in editor)) {
      throw new Error('EditorWorker: no such method:' + data.call)
    }
    ; (editor as any)[data.call](data)
  }
}
