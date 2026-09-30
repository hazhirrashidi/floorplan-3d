/* Floor Plan 3D — preload (sandboxed, contextIsolation)
 * Exposes a minimal, promise-based bridge to the renderer:
 *   window.floorplanDesktop.saveDataUrl({ defaultName, dataUrl }) -> saved path | null
 *   window.floorplanDesktop.openText({ filters })                 -> { name, path, content } | null
 *   window.floorplanDesktop.onMenu(cb)                            -> menu events ('new'|'open'|'save'|'image')
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('floorplanDesktop', {
  isDesktop: true,
  saveDataUrl: opts => ipcRenderer.invoke('fp:save', opts),
  openText: opts => ipcRenderer.invoke('fp:open', opts),
  onMenu: cb => {
    for (const id of ['new', 'open', 'save', 'image']) ipcRenderer.on('menu:' + id, () => cb(id));
  }
});
