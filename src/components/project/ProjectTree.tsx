import { useState } from 'react'
import { ChevronDown, ChevronRight, FilePlus2, FileText, Folder, FolderOpen } from 'lucide-react'
import type { ProjectFile } from '../../types'

type Props = {
  files: ProjectFile[]
  activeFile?: string
  onOpenFile: (file: ProjectFile) => void
  onCreateFile: (folder: string, name: string) => void
}

export function ProjectTree({ files, activeFile, onOpenFile, onCreateFile }: Props) {
  const [openFolders, setOpenFolders] = useState<string[]>(['strategy', 'research', 'docs'])
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const toggleFolder = (folder: string) => {
    setOpenFolders((current) => current.includes(folder) ? current.filter((item) => item !== folder) : [...current, folder])
  }

  const createFile = (folder: string) => {
    const name = newName.trim()
    if (name) onCreateFile(folder, name.includes('.') ? name : `${name}.md`)
    setNewName('')
    setAddingTo(null)
  }

  return (
    <div className="file-tree">
      {['strategy', 'research', 'docs'].map((folder) => {
        const isOpen = openFolders.includes(folder)
        return (
          <div className="tree-folder" key={folder}>
            <div className="tree-folder-row">
              <button className="tree-folder-toggle" onClick={() => toggleFolder(folder)} aria-label={`${isOpen ? 'Свернуть' : 'Раскрыть'} ${folder}`}>
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
                <span>{folder}/</span>
              </button>
              <button className="tree-add" onClick={() => { setAddingTo(folder); setOpenFolders((current) => current.includes(folder) ? current : [...current, folder]) }} aria-label={`Создать файл в ${folder}`} title="Новый файл">
                <FilePlus2 size={13} />
              </button>
            </div>
            {isOpen && <div className="tree-children">
              {files.filter((file) => file.folder === folder).map((file) => (
                <button className={`tree-file ${activeFile === file.id ? 'is-active' : ''}`} key={file.id} onClick={() => onOpenFile(file)}>
                  <FileText size={13} /><span>{file.name}</span>
                </button>
              ))}
              {addingTo === folder && <form className="tree-create" onSubmit={(event) => { event.preventDefault(); createFile(folder) }}>
                <FileText size={13} />
                <input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} onBlur={() => { if (!newName.trim()) setAddingTo(null) }} onKeyDown={(event) => { if (event.key === 'Escape') setAddingTo(null) }} placeholder="имя-файла.md" aria-label="Имя нового файла" />
              </form>}
            </div>}
          </div>
        )
      })}
    </div>
  )
}