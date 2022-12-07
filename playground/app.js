import './editor.css'
import Editor from '../src/editor'
import { ask } from '../src/util'

const container = document.createElement('div')
document.body.appendChild(container)

const main = async () => {
  const value = 'hello world' //await (await fetch('./playground/app.js')).text()

  const files = (self.files = [
    { id: 'abcd1', title: 'abcd 1', value },
    // { id: 'abcd2', title: 'abcd 2', value },
    // { id: 'abcd3', title: 'abcd 3', value },
  ])

  for (let i = 0; i < 5; i++) {
    const editor = new Editor({
      files,
      width: 300,
      height: 300,
      pixelRatio: window.devicePixelRatio,
      titlebarHeight: 0,
      pseudoWorker: true,
    })
    editor.appendTo(container)
  }

  const editor = (self.editor = new Editor({
    files,
    width: 300,
    height: 300,
    pixelRatio: window.devicePixelRatio,
    titlebarHeight: 25,
    pseudoWorker: true,
  }))
  editor.onkeydown = (e, file) => {
    if (e.cmdKey && e.key === 'b') {
      file.delete()
      return false
    }
    if (e.cmdKey && e.key === 'm') {
      ask('Change name', `Type a new name for "${file.title}"`, file.title).then(result => {
        if (result) {
          if (!result.value.trim()) {
            result.value = 'untitled'
          }
          file.rename(result.value)
        }
      })
      return false
    }
    if (e.cmdKey && e.key === 'j') {
      editor.addFile()
    }
    if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
      file.moveUp()
    }
    if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
      file.moveDown()
    }
  }
  editor.appendTo(container)
  editor.focus()
  // editor.files[1].focus()
}

main()
