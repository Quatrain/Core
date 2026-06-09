import { QuatrainDictionary } from '@quatrain/i18n'

/**
 * French translation dictionary mapping for Quatrain table and UI components.
 */
export const frDictionary: QuatrainDictionary = {
    table: {
        uid: 'Identifiant',
        id: 'ID',
        status: 'Statut',
        createdAt: 'Créé le',
        createdBy: 'Créé par',
        updatedAt: 'Modifié le',
        updatedBy: 'Modifié par',
        deletedAt: 'Supprimé le',
        deletedBy: 'Supprimé par',
        showMeta: 'Afficher les métadonnées système',
        noData: 'Aucune donnée disponible',
        rowsPerPage: 'Lignes par page',
        searchPlaceholder: 'Rechercher...',
        loading: 'Chargement des données...'
    },
    statuses: {
        active: 'Actif',
        approved: 'Approuvé',
        archived: 'Archivé',
        blocked: 'Bloqué',
        cancelled: 'Annulé',
        completed: 'Terminé',
        converting: 'Conversion en cours',
        created: 'Créé',
        deletable: 'Supprimable',
        deleted: 'Supprimé',
        disabled: 'Désactivé',
        done: 'Fait',
        draft: 'Brouillon',
        downloading: 'Téléchargement en cours',
        downloaded: 'Téléchargé',
        download_ko: 'Échec du téléchargement',
        error: 'Erreur',
        expired: 'Expiré',
        failed: 'Échoué',
        generating: 'Génération en cours',
        generated: 'Généré',
        in_progress: 'En cours',
        ko: 'Échoué',
        ok: 'OK',
        paused: 'En pause',
        pending: 'En attente',
        preparing: 'Préparation en cours',
        processing: 'Traitement en cours',
        published: 'Publié',
        queued: 'Mis en file d’attente',
        rejected: 'Rejeté',
        running: 'En cours d’exécution',
        success: 'Succès',
        suspended: 'Suspendu',
        unknown: 'Inconnu',
        updated: 'Mis à jour',
        uploading: 'Envoi en cours',
        uploaded: 'Envoyé',
        upload_ko: 'Échec de l’envoi',
        validated: 'Validé',
        zipping: 'Archivage en cours'
    },
    errors: {
        weak_password: 'Le mot de passe n’est pas assez complexe',
    }
}

