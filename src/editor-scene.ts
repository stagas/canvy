import $ from 'sigl'
import { ImmSet } from 'immutable-map-set'
import { CanvyElement } from './editor'
import { Rect } from 'geometrik'

export interface EditorScene extends $.Reactive<EditorScene> { }

@$.reactive()
export class EditorScene {
  selectionText = ''
  editors = new ImmSet<CanvyElement>()
  caret?: null

  isValidTarget?: (el: HTMLElement) => boolean

  ignoredElements: any[] = []

  activeEditor?: CanvyElement | null
  fullEditor?: CanvyElement | null

  layout!: {
    pos: $.Point
    viewFrameNormalRect?: $.Rect
    state: any
    viewMatrix?: $.Matrix
  }

  constructor(data: Partial<EditorScene>) {
    Object.assign(this, data)
  }

  created($: EditorScene['$']) {
    $.effect(({ layout, editors, isValidTarget }) => {
      if (!editors.size) return

      let lastScrollTime = 0
      let scrollTop: number = document.documentElement.scrollTop

      // let didMovePointer = false

      const rects = new Map<any, $.Rect>()

      const findEditorFromEvent = (e: PointerEvent | WheelEvent) => {
        const pointerPos = new $.Point(e.pageX, e.pageY)
        // if ($.fullEditor) {
        //   if (
        //     pointerPos.withinRect(
        //       $.fullEditor.rect!.sub(layout?.pos ?? new $.Point())
        //     )
        //   ) {
        //     return { editor: $.fullEditor, pointerPos, normalizedPointerPos: pointerPos }
        //   }
        //   return { pointerPos, normalizedPointerPos: pointerPos }
        // }

        const normalizedPointerPos = pointerPos.translate(0, -scrollTop)

        // .sub(layout?.pos ?? new $.Point()).normalizeSelf(
        //   layout.viewMatrix ?? new $.Matrix()
        // ) //.translate(0, scrollTop) //.sub(new $.Point(0, scrollTop)) //.sub(new $.Point(0, scrollTop))

        for (const editor of editors) {
          const rect = new $.Rect(editor.getBoundingClientRect())
          if (!rects.get(editor)?.equals(rect)) {
            lastScrollTime = performance.now()
            intentMove = false
            // wheeling++
          }
          rects.set(editor, rect)
          // console.log(rect, pointerPos)

          const targetRect = new Rect(rect)
          // .setWidth(rect.width - (e.type === 'wheel' ? 20 : 0))

          if (normalizedPointerPos.withinRect(targetRect)) {
            return {
              editor,
              pointerPos, //: pointerPos.translate(0, -rect.y),
              normalizedPointerPos: normalizedPointerPos.translate(-rect.x, -rect.y)
            }
          }
        }

        if ($.activeEditor) {
          if ($.activeEditor.hoveringMarker) {
            $.activeEditor.editor.leaveMarker()
          }
          const rect = new $.Rect($.activeEditor.getBoundingClientRect())
          return {
            pointerPos,
            normalizedPointerPos: normalizedPointerPos.translate(-rect.x, -rect.y)
          }
        }

        return { pointerPos, normalizedPointerPos }
      }

      const mouseEventToJson = (e: PointerEvent | WheelEvent) => ({
        deltaX: (e as WheelEvent).deltaX,
        deltaY: (e as WheelEvent).deltaY,
        cmdKey: $.isMac ? e.metaKey : e.ctrlKey,
        left: e.buttons & $.MouseButton.Left,
        middle: e.buttons & $.MouseButton.Middle,
        right: e.buttons & $.MouseButton.Right,
      })

      const handleKeyEvent = (e: KeyboardEvent, editor: CanvyElement) => {
        const { key, which, code, altKey, shiftKey, ctrlKey, metaKey } = e
        const cmdKey = $.isMac ? metaKey : ctrlKey

        if (cmdKey && code === 'Backquote') return false

        // this is a whitelist
        // i.e these keypresses are not going
        // to be handled by our system at all
        if (cmdKey && key === 'r') return false
        if (cmdKey && key === '+') return false
        if (cmdKey && key === '-') return false

        if (cmdKey && key === 'c') {
          if (e.type === 'keydown') {
            navigator.clipboard.writeText($.selectionText)
            return false
          }
        }
        if (cmdKey && key === 'x') {
          if (e.type === 'keydown') {
            navigator.clipboard.writeText($.selectionText)
            $.selectionText = ''
          }
        }
        if (cmdKey && (key === 'v' || key === 'V')) {
          if (e.type === 'keydown') {
            navigator.clipboard.readText().then(text => {
              $.activeEditor?.handleEvent('paste', { text })
            })
            return false
          }
        }

        if (cmdKey && shiftKey && key === 'I') return false
        if (cmdKey && shiftKey && key === 'J') return false

        if (altKey && (key === 'ArrowLeft' || key === 'ArrowRight')) return false

        const ev = {
          key,
          which,
          char: String.fromCharCode(which),
          altKey,
          shiftKey,
          ctrlKey,
          metaKey,
          cmdKey,
          caret: $.caret,
        }

        e.stopPropagation()
        e.preventDefault()
        editor.handleEvent(e.type, ev)
      }

      let wheeling = 0
      const debounceOffWheeling = $.queue.debounce(450)(() => {
        wheeling = 0
      })

      const handleMouseEvent = (name: string, e: PointerEvent | WheelEvent, editor: CanvyElement, pos: $.Point) => {
        // if ('deltaX' in e && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
        const result = editor.handleEvent(name, {
          ...mouseEventToJson(e),
          clientX: pos.x, //- editor.pos!.x + (layout.pos?.x ?? 0),
          clientY: pos.y //- editor.pos!.y + (layout.pos?.y ?? 0),
        })
        if (result !== false || (wheeling > 0 && wheeling < 15)) {
          if (result === true) wheeling = 1
          e.stopPropagation()
          e.preventDefault()
          if (name === 'mousewheel') {
            if (result === false) {
              wheeling += 1
              // didMovePointer = false
            }
            debounceOffWheeling()
          }
        } else {
          wheeling = 0
          intentMove = false
        }
      }

      let isDown = false
      let intentMove = false as false | Element
      let intentMoveTimeout: any
      const stopIntentMove = () => {
        clearTimeout(intentMoveTimeout)
        // intentMoveTimeout = setTimeout(() => {
        //   intentMove = false
        // }, 200)
      }

      // const isValidTarget = (el: any) => {
      //   const part = el.getAttribute?.('part')

      //   // console.log(part)
      //   if (part !== 'item' && part !== 'sliders' && part !== 'side') return false

      //   return true
      // }

      return $.chain(
        $.on(window, 'scroll')(() => {
          lastScrollTime = performance.now()
          scrollTop = document.documentElement.scrollTop
          // console.log(scrollTop)
        }),
        $.on(window).pointermove.raf(e => {
          // didMovePointer = true
          if (!$.layout.viewMatrix) return

          if (!$.activeEditor && $.layout.viewMatrix.a < 0.65) return

          if (!layout.state.isIdle) return

          if (e.altKey) return

          const ev = findEditorFromEvent(e)
          const { normalizedPointerPos } = ev

          let { editor } = ev
          if (isDown && !editor) editor = $.activeEditor as any
          if (editor) {
            intentMove = editor
            stopIntentMove()
          } else {
            intentMove = false
          }
          if (editor && $.activeEditor === editor) {
            handleMouseEvent('mousemove', e, editor, normalizedPointerPos)
            return
          }
        }),
        $.on(window).pointerdown.capture((e) => {
          const [firstElement] = e.composedPath()

          if (!isValidTarget(firstElement as any)) return

          {
            const editor = (firstElement as any).getRootNode().host
            editor.rect = new $.Rect(editor.getBoundingClientRect())
          }
          // }

          // queueMicrotask(() => {
          if (!(e.buttons & $.MouseButton.Left)) return
          if (!layout.state.isIdle) return
          if (e.altKey) return

          const focused = $.getActiveElement(document.activeElement) as HTMLElement
          if (focused !== document.body) focused?.blur()


          // if (part !== 'contents' && part !== 'canvas') {
          //   // }
          //   // if ($.ignoredElements.includes(firstElement.constructor)) {
          //   if ($.activeEditor) {
          //     $.activeEditor._onblur()
          //     $.activeEditor = null
          //   }
          //   return
          // }

          const { editor, normalizedPointerPos } = findEditorFromEvent(e)
          if (editor) {
            clearTimeout(intentMoveTimeout)
            isDown = true
            if ($.activeEditor && $.activeEditor !== editor) {
              $.activeEditor._onblur()
            }
            $.activeEditor = editor
            editor.focus({ preventScroll: true })
            handleMouseEvent('mousedown', e, editor, normalizedPointerPos)
          } else {
            if ($.activeEditor) {
              $.activeEditor._onblur()
              $.activeEditor = null
            }
          }
          // })
        }),
        $.on(window).pointerup(e => {
          if (e.altKey) return

          if (!isDown) return

          isDown = false

          const { editor = $.activeEditor, normalizedPointerPos } = findEditorFromEvent(e)
          if (editor || isDown) {
            handleMouseEvent('mouseup', e, editor!, normalizedPointerPos)
          }
        }),
        $.on(window).keydown(e => {
          if (e.altKey) return

          if ($.activeEditor) {
            handleKeyEvent(e, $.activeEditor)
          }
        }),
        $.on(window).keyup(e => {
          if (e.altKey) return

          if ($.activeEditor) {
            handleKeyEvent(e, $.activeEditor)
          }
        }),
        $.on(window).wheel.not.passive.capture(e => {
          if (!layout.viewMatrix || !layout.viewFrameNormalRect) return
          if (e.altKey) return

          const { editor, normalizedPointerPos } = findEditorFromEvent(e)

          const [firstElement] = e.composedPath() as [HTMLElement]

          if (!isValidTarget(firstElement)) return

          if (editor && performance.now() - lastScrollTime > 300) {
            intentMove = editor
          }

          if (editor && (
            // (layout.viewMatrix.a >= 0.65)
            // && layout.state.isIdle
            // && editor.rect!.withinRect(layout.viewFrameNormalRect.zoomLinear(50))
            // &&
            intentMove === editor
          )) {
            clearTimeout(intentMoveTimeout)
            handleMouseEvent('mousewheel', e, editor, normalizedPointerPos)
          }
        })
      )
    })
  }

  register(editor: CanvyElement) {
    this.editors = this.editors.add(editor)
    editor.$.effect(() => () => {
      this.editors = this.editors.delete(editor)
    })
  }
}
