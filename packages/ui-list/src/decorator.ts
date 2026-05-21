/**
 * Configuration options for the CoreList decorator.
 */
export interface CoreListConfig {
    /** The backend API endpoint string, e.g. 'companies' */
    endpoint?: string
    
    /** The default sorting field and order */
    defaultSorting?: {
        field: string
        order: 'asc' | 'desc'
    }
    
    /** Column metadata definitions mapped by field name */
    columns?: Record<string, any>
    
    /** Contextual action button configurations */
    buttons?: Record<string, any>
    
    /** Custom API action functions, such as custom load actions */
    actions?: {
        list?: (params: any) => Promise<any>
        [key: string]: any
    }
    
    /** The Quatrain model schema itself if applicable */
    modelSchema?: any
    
    /** Number of rows per page */
    pagesize?: number
}

/**
 * A class decorator that binds a list configuration to a controller or exposer class.
 * This stores the settings on the class constructor and prototype for retrieval by CoreListManager.
 * 
 * @param config - The list configuration object.
 * @returns A class decorator function.
 */
export function CoreList(config: CoreListConfig) {
    return function (target: any) {
        target.listConfig = config;
        if (target.prototype) {
            target.prototype.listConfig = config;
        }
    };
}
