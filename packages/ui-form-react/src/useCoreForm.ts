import { useEffect, useState, useMemo } from 'react'
import { CoreFormManager, FormState } from '@quatrain/ui'

/**
 * A React hook that provides an interface to the headless CoreFormManager.
 * It automatically subscribes to state changes and returns the form state along with methods to update and save data.
 * 
 * @param modelSchema - The schema of the Quatrain model being edited.
 * @param objectId - The unique identifier of the object, or 'new' if creating a new one.
 * @param apiClient - The API client to be used for fetching and saving data.
 * @returns An object containing the current `state`, a `setFieldValue` function, and a `save` function.
 */
export function useCoreForm(modelSchema: any, objectId: string | undefined, apiClient: any) {
    const manager = useMemo(() => new CoreFormManager(modelSchema, objectId, apiClient), [modelSchema, objectId, apiClient])

    const [state, setState] = useState<FormState>({
        formData: { status: 'created' },
        relationOptions: {},
        status: 'idle',
        error: null
    })

    useEffect(() => {
        const unsubscribe = manager.subscribe((newState) => {
            setState(newState)
        })
        manager.init()
        return unsubscribe
    }, [manager])

    return {
        state,
        setFieldValue: (field: string, value: any) => manager.setFieldValue(field, value),
        save: () => manager.save()
    }
}
