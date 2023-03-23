export enum Status {
   CREATED = 'created',
   PENDING = 'pending',
   ACTIVE = 'active',
   ERROR = 'error',
   TEST = 'test',
   SUSPENDED = 'suspended',
   DELETABLE = 'deletable',
   DELETED = 'deleted',
   DONE = 'done',
   MAINTENANCE = 'maintenance',
   UNKNOWN = 'unknown',
}

export default { ...Status }
