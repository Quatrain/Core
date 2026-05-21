import { Card, Button, Group } from '@mantine/core'
import { CoreList } from '@quatrain/ui-list-react'
import { ManagerHeader } from './components/ManagerUI'
import { apiClient } from './api'
import { useI18n } from './i18nContext'

/**
 * Interface representing the required props for the DataExplorer component.
 */
export interface DataExplorerProps {
  /** The dynamic model object from active workspace state */
  model: {
    uid: string
    name: string
    collectionName?: string
    version?: number
  }
  
  /** Loaded property configurations associated with the selected version of this model */
  properties: any[]
  
  /** Callback triggered to go back to the models listing */
  onBack: () => void
}

/**
 * DataExplorer component provides a dynamic database data table and query interface
 * for any deployed model. It leverages the headless @quatrain/ui-list core engine and
 * Mantine-styled @quatrain/ui-list-react tables.
 * 
 * @param props - DataExplorerProps configurations.
 * @returns React functional component rendering the dynamic table explorer.
 */
export function DataExplorer({ model, properties, onBack }: DataExplorerProps) {
  const { t, locale } = useI18n()

  const endpoint = model.collectionName || `${model.name.toLowerCase()}s`

  // Construct options for CoreList
  const listOptions = {
    apiClient,
    endpoint,
    modelSchema: {
      name: model.name,
      properties: properties
    },
    initialPageSize: 10,
    config: {
      buttons: {
        delete: {
          label: { en: 'Delete', fr: 'Supprimer' },
          options: { negative: true },
          action: async (row: any, { manager }: any) => {
            const confirmMsg = locale === 'fr' 
              ? `Voulez-vous vraiment supprimer cet enregistrement ?` 
              : `Are you sure you want to delete this record?`
            if (window.confirm(confirmMsg)) {
              try {
                await apiClient.delete(`${endpoint}/${row.uid}`, {})
                manager.query()
              } catch (e: any) {
                alert(`Error deleting record: ${e.message}`)
              }
            }
          }
        }
      }
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <ManagerHeader 
        title={t('model.modelData') || "Données du modèle"} 
        description={
          locale === 'fr'
            ? `Explorez et gérez les enregistrements de la collection "${endpoint}" pour le modèle "${model.name}".`
            : `Explore and manage records of collection "${endpoint}" for model "${model.name}".`
        }
      >
        <Group>
          <Button variant="subtle" color="gray" onClick={onBack}>
            ← {t('createModel.cancel') || "Retour"}
          </Button>
        </Group>
      </ManagerHeader>

      <Card shadow="sm" radius={0} p={0} withBorder>
        <CoreList 
          options={listOptions}
          title={model.name}
          lang={locale as 'en' | 'fr'}
        />
      </Card>
    </div>
  )
}
