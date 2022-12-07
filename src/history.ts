import { Area, Event, LogEntry, Point } from 'zerolag'
import { debounce } from './util'

interface Meta {
  editor: any
  caret: Point //editor.caret.pos.copy(),
  mark: Area //editor.mark.copy(),
  markActive: boolean //editor.markActive,
}

export interface Commit {
  editor: any
  log: LogEntry[]
  undo: Meta //this.meta,
  redo: Meta
  // {
  //   editor: any
  //   caret: Point //editor.caret.pos.copy(),
  //   mark: Area //editor.mark.copy(),
  //   markActive: boolean //editor.markActive,
  // }
}

export class History extends Event {
  editor: any
  debouncedSave: any

  log: (Commit | null)[] = [null]
  needle = 1
  lastNeedle = 1
  timeout: any = true
  timeStart = 0
  didSave = false
  meta?: Meta

  constructor(editor: any) {
    super()
    this.editor = editor
    this.clear()
    this.debouncedSave = debounce(this.actuallySave.bind(this), 300)
  }
  clear() {
    this.editor.buffer.log = []
    this.log = [null]
    this.needle = 1
    this.lastNeedle = 1
    this.timeout = true
    this.timeStart = 0
    this.saveMeta()
  }
  toJSON() {
    return {
      log: this.log.map(commit =>
        commit
          ? {
            ...commit,
            editor: commit.editor.id,
            undo: {
              ...commit.undo,
              editor: commit.undo.editor.id,
            },
            redo: {
              ...commit.redo,
              editor: commit.redo.editor.id,
            },
          }
          : commit
      ),
      needle: this.needle,
      lastNeedle: this.lastNeedle,
    }
  }
  //
  setEditor(editor: any) {
    if (this.editor !== editor) {
      this.actuallySave(true)
    }
    this.editor = editor
  }
  save(force?: boolean) {
    this.emit('edit', this.editor)
    if (this.lastNeedle === this.needle) {
      this.needle++
      this.emit('save', this.editor)
      this.saveMeta()
    }
    if (Date.now() - this.timeStart > 2000 || force) {
      this.actuallySave()
    }
    this.timeout = this.debouncedSave()
    return this
  }
  actuallySave(noEmit?: boolean) {
    clearTimeout(this.timeout)
    this.didSave = false
    if (this.editor.buffer.log.length) {
      this.didSave = true
      this.log = this.log.slice(0, this.lastNeedle)
      this.log.push(this.commit())

      this.needle = ++this.lastNeedle
      this.saveMeta()
      if (!noEmit) {
        this.emit('save', this.editor)
        this.emit('change', this.editor)
      }
    } else {
      this.saveMeta()
    }
    this.timeStart = Date.now()
    this.timeout = false
  }
  undo(needle: number) {
    if (this.timeout !== false) this.actuallySave(true)

    if (needle < 1) return

    this.lastNeedle = this.needle = needle
    return this.checkout('undo', needle)
  }
  redo(needle: number) {
    if (this.timeout !== false) this.actuallySave(true)

    if (needle < 1) return

    this.lastNeedle = this.needle = Math.min(needle, this.log.length)
    return this.checkout('redo', needle - 1)
  }
  checkout(type: 'undo' | 'redo', n: number) {
    let commit: Commit | Meta = this.log[n]!
    if (!commit) return

    let log = (commit as Commit).log
    commit = this.log[n]![type] as Meta
    commit.editor.controlEditor.setFocusedEditor(commit.editor)
    commit.editor.markActive = commit.markActive
    commit.editor.mark.set(commit.mark.copy())
    commit.editor.setCaret(commit.caret.copy())

    log = 'undo' === type ? log.slice().reverse() : log.slice()

    log.forEach(item => {
      const [action, offsets, text] = item
      switch (action) {
        case 'insert':
          if ('undo' === type) {
            commit.editor.buffer.remove(offsets, true)
          } else {
            commit.editor.buffer.insert(commit.editor.buffer.getOffsetPoint(offsets[0]), text, true)
          }
          break
        case 'remove':
          if ('undo' === type) {
            commit.editor.buffer.insert(commit.editor.buffer.getOffsetPoint(offsets[0]), text, true)
          } else {
            commit.editor.buffer.remove(offsets, true)
          }
          break
      }
    })

    if (this.didSave) {
      this.emit('save', this.editor)
      this.didSave = false
    }
    this.emit('change', commit.editor)

    return commit.editor
  }
  commit(): Commit {
    const editor = this.meta!.editor
    const log = editor.buffer.log
    editor.buffer.log = []
    return {
      editor,
      log: log,
      undo: this.meta!,
      redo: {
        editor: editor,
        caret: editor.caret.pos.copy(),
        mark: editor.mark.copy(),
        markActive: editor.markActive,
      },
    }
  }
  saveMeta() {
    this.meta = {
      editor: this.editor,
      caret: this.editor.caret.pos.copy(),
      mark: this.editor.mark.copy(),
      markActive: this.editor.markActive,
    }
  }
}
