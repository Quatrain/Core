export interface FolderStatsType {
   name: string
   path: string
   totalObjects: number
   totalSize: number
   lastModified?: Date
}

export interface BucketStatsType {
   bucket: string
   totalObjects: number
   totalSize: number
   folders: Record<string, FolderStatsType>
}
