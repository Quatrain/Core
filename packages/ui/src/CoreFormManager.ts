/**
 * Represents the internal state of the CoreFormManager.
 */
export type FormState = {
    formData: any
    relationOptions: Record<string, { label: string, value: string }[]>
    status: 'idle' | 'loading' | 'saving' | 'error'
    error: any | null
    validationErrors: Record<string, string>
}

/**
 * Headless form manager for Quatrain models.
 * Handles API interactions, relational data fetching, and state management
 * independently of any UI framework.
 */
export class CoreFormManager {
    protected modelSchema: any
    protected objectId: string | undefined
    protected apiClient: any

    protected state: FormState = {
        formData: { status: 'created' },
        relationOptions: {},
        status: 'idle',
        error: null,
        validationErrors: {}
    }

    protected listeners: ((state: FormState) => void)[] = []

    /**
     * Initializes a new instance of the CoreFormManager.
     * 
     * @param modelSchema - The schema definition of the Quatrain model to manage.
     * @param objectId - The unique identifier of the object to edit, or 'new' for a new object.
     * @param apiClient - The API client instance used to communicate with the backend.
     */
    constructor(modelSchema: any, objectId: string | undefined, apiClient: any) {
        this.modelSchema = modelSchema
        this.objectId = objectId
        this.apiClient = apiClient
    }

    /**
     * Subscribes a listener to state changes.
     * 
     * @param listener - A callback function that receives the updated FormState.
     * @returns A cleanup function to unsubscribe the listener.
     */
    public subscribe(listener: (state: FormState) => void) {
        this.listeners.push(listener)
        listener(this.state) // Emit current state immediately
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    protected emit() {
        for (const listener of this.listeners) {
            listener({ ...this.state })
        }
    }

    protected patchState(partialState: Partial<FormState>) {
        this.state = { ...this.state, ...partialState }
        this.emit()
    }

    /**
     * Initializes the form manager by fetching the necessary data and relations.
     * Updates the status to 'loading' during execution and 'idle' upon completion.
     */
    public async init() {
        this.patchState({ status: 'loading', error: null })
        try {
            await Promise.all([
                this.fetchData(),
                this.fetchRelations()
            ])
            this.patchState({ status: 'idle' })
        } catch (e: any) {
            console.error('Failed to init form', e)
            this.patchState({ status: 'error', error: e })
        }
    }

    protected async fetchData() {
        if (this.objectId && this.objectId !== 'new') {
            const m = this.modelSchema.name
            const res = await this.apiClient.get(`${m.toLowerCase()}s/` + this.objectId)
            if (res && res.data) {
                this.patchState({ formData: { ...this.state.formData, ...res.data } })
            }
        }
    }

    protected async fetchRelations() {
        const props = this.modelSchema.properties || []
        const newRelationOptions = { ...this.state.relationOptions }
        
        const relationPromises = props.map(async (p: any) => {
            if (p.options?.instanceOf) {
                const targetModel = typeof p.options.instanceOf === 'string' ? p.options.instanceOf : p.type
                const url = `${targetModel.toLowerCase()}s/values`
                try {
                    const res = await this.apiClient.get(url)
                    if (res && res.data) {
                        const pattern = p.options?.pattern
                        const formattedData = res.data.map((item: any) => {
                            let label = item.name || item.value
                            if (pattern) {
                                label = pattern.replace(/\$\{([^}]+)\}/g, (match: string, prop: string) => {
                                    return item[prop] !== undefined ? String(item[prop]) : match
                                })
                            }
                            return { label, value: item.value, _search: item._search || '' }
                        })
                        newRelationOptions[p.name] = formattedData
                    }
                } catch (e) {
                    console.error('Failed to load relation values for', p.name, e)
                }
            }
        })

        await Promise.all(relationPromises)
        this.patchState({ relationOptions: newRelationOptions })
    }

    /**
     * Validates the form data against the model schema.
     * Checks for mandatory fields.
     * 
     * @returns boolean - true if the form is valid, false otherwise.
     */
    public validate(): boolean {
        const errors: Record<string, string> = {}
        const props = this.modelSchema.properties || []

        for (const prop of props) {
            if (prop.mandatory || prop.required) { // Handle both terminologies depending on how schema generates it
                const val = this.state.formData[prop.name]
                if (val === undefined || val === null || val === '') {
                    errors[prop.name] = `${prop.name} is required`
                }
            }
        }

        this.patchState({ validationErrors: errors })
        return Object.keys(errors).length === 0
    }

    /**
     * Updates the value of a specific property in the form data.
     * 
     * @param property - The name of the property to update.
     * @param value - The new value for the property.
     */
    public setProperty(property: string, value: any) {
        this.patchState({
            formData: { ...this.state.formData, [property]: value }
        })
    }

    /**
     * Saves the current form data to the backend via the API client.
     * Performs a POST request for new objects or a PATCH request for existing objects.
     * Performs local validation before attempting to save.
     * 
     * @throws Will throw an error if the API request fails or validation fails.
     */
    public async save() {
        if (!this.validate()) {
            throw new Error('Validation failed')
        }

        this.patchState({ status: 'saving', error: null, validationErrors: {} })
        try {
            const m = this.modelSchema.name
            if (this.objectId === 'new') {
                await this.apiClient.post(`${m.toLowerCase()}s`, this.state.formData)
            } else {
                await this.apiClient.patch(`${m.toLowerCase()}s/` + this.objectId, this.state.formData)
            }
            this.patchState({ status: 'idle' })
        } catch (e: any) {
            console.error('Failed to save form', e)
            
            // Map backend validation errors to UI state if present
            const validationErrors = e.response?.data?.validationErrors || {}
            this.patchState({ status: 'error', error: e, validationErrors })
            
            throw e
        }
    }
}
