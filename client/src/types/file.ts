/** 前端文件列表项（经过 getFileList 映射后的统一格式） */
export interface FileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  size: string
  time: string
  isEditing?: boolean
  folderId?: string | null
  originalPath?: string
}

/** 后端返回的文件项原始数据 */
export interface ApiFileItem {
  id: string
  name: string
  size: string
  time: string
  folderId: string | null
}

/** 后端返回的文件夹项原始数据 */
export interface ApiFolderItem {
  _id: string
  name: string
  parentId: string | null
  createdAt: string
}

/** 回收站项 */
export interface TrashItem {
  id: string
  name: string
  type: 'file' | 'folder'
  size: string
  deleteTime: string
  time?: string
  originalFolderId: string | null
  originalPath: string
  isEditing?: boolean
}

/** 分享项 */
export interface ShareItem {
  id: string
  shareType: 'file' | 'folder'
  shareName: string
  shareCode: string
  hasPassword: boolean
  expireAt: string | null
  viewCount: number
  downloadCount: number
  status: 'active' | 'expired' | 'revoked'
  createdAt: string
}

/** 文件夹树节点（MoveDialog 用） */
export interface FolderTreeNode {
  _id: string
  name: string
  children: FolderTreeNode[]
}

/** 上传的文件信息 */
export interface UploadFile {
  name: string
  size: number
}
