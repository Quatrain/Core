/**
 * Represents the internal state of the CoreFormManager.
 */
export type FormState = {
    formData: any
    relationOptions: Record<string, { label: string, value: string }[]>
    status: 'idle' | 'loading' | 'saving' | 'error'
    error: any | null
}

/**
 * Headless form manager for Quatrain models.
 * Handles API interactions, relational data fetching, and state management
 * independently of any UI framework.
 */
export class CoreFormManager {
    private modelSchema: any
    private objectId: string | undefined
    private apiClient: any

    private state: FormState = {
        formData: { status: 'created' },
        relationOptions: {},
        status: 'idle',
        error: null
    }

    private listeners: ((state: FormState) => void)[] = []

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

    private emit() {
        for (const listener of this.listeners) {
            listener({ ...this.state })
        }
    }

    private setState(partialState: Partial<FormState>) {
        this.state = { ...this.state, ...partialState }
        this.emit()
    }

    /**
     * Initializes the form manager by fetching the necessary data and relations.
     * Updates the status to 'loading' during execution and 'idle' upon completion.
     */
    public async init() {
        this.setState({ status: 'loading', error: null })
        try {
            await Promise.all([
                this.fetchData(),
                this.fetchRelations()
            ])
            this.setState({ status: 'idle' })
        } catch (e: any) {
            console.error('Failed to init form', e)
            this.setState({ status: 'error', error: e })
        }
    }

    private async fetchData() {
        if (this.objectId && this.objectId !== 'new') {
            const m = this.modelSchema.name
            const res = await this.apiClient.get(`${m.toLowerCase()}s/` + this.objectId)
            if (res && res.data) {
                this.setState({ formData: { ...this.state.formData, ...res.data } })
            }
        }
    }

    private async fetchRelations() {
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
                            return { label, value: item.value }
                        })
                        newRelationOptions[p.name] = formattedData
                    }
                } catch (e) {
                    console.error('Failed to load relation values for', p.name, e)
                }
            }
        })

        await Promise.all(relationPromises)
        this.setState({ relationOptions: newRelationOptions })
    }

    /**
     * Updates the value of a specific field in the form data.
     * 
     * @param field - The name of the field to update.
     * @param value - The new value for the field.
     */
    public setFieldValue(field: string, value: any) {
        this.setState({
            formData: { ...this.state.formData, [field]: value }
        })
    }

    /**
     * Saves the current form data to the backend via the API client.
     * Performs a POST request for new objects or a PATCH request for existing objects.
     * 
     * @throws Will throw an error if the API request fails.
     */
    public async save() {
        this.setState({ status: 'saving', error: null })
        try {
            const m = this.modelSchema.name
            if (this.objectId === 'new') {
                await this.apiClient.post(`${m.toLowerCase()}s`, this.state.formData)
            } else {
                await this.apiClient.patch(`${m.toLowerCase()}s/` + this.objectId, this.state.formData)
            }
            this.setState({ status: 'idle' })
        } catch (e: any) {
            console.error('Failed to save form', e)
            this.setState({ status: 'error', error: e })
            throw e
        }
    }
}
