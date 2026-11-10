import React, { createContext, useContext, useMemo } from 'react'
import { useDataQuery } from '@dhis2/app-runtime'
import useSessionCachedQuery from '../Pages/services/engines/sessionCachedQuery'

const ACCESS_USER_QUERY = {
    me: {
        resource: 'me',
        params: {
            fields: 'id,displayName,userGroups[id,displayName],userRoles[id,displayName]',
        },
    },
}

const ACCESS_SETTINGS_QUERY = {
    settings: {
        resource: 'dataStore/CH_Bulletin/settings',
    },
}

// Rendered outside a provider (standalone tests) everything stays closed.
const CLOSED = {
    loading: false,
    canDraft: false,
    canPublish: false,
    canConfigure: false,
}

const AccessContext = createContext(null)

export const AccessProvider = ({ children }) => {
    const { loading: userLoading, data: userData } = useSessionCachedQuery(
        ACCESS_USER_QUERY,
        'access-user'
    )
    const { loading: settingsLoading, data: settingsData } = useDataQuery(
        ACCESS_SETTINGS_QUERY
    )
    const loading = userLoading || settingsLoading

    const value = useMemo(() => {
        const me = userData?.me
        const settings = settingsData?.settings

        const membership = new Set([
            ...(me?.userGroups ?? []).map((group) => group.id),
            ...(me?.userRoles ?? []).map((role) => role.id),
        ])

        // An empty list means the gate has not been configured yet. Leaving it
        // open keeps a first-time setup from locking everyone out of Settings.
        const isAllowed = (configured) =>
            (configured ?? []).length === 0 ||
            configured.some((id) => membership.has(id))

        // While loading every gate reports closed, so privileged controls never
        // appear and then disappear once the query resolves.
        return {
            loading,
            canDraft: !loading && isAllowed(settings?.generationRoles),
            canPublish: !loading && isAllowed(settings?.reviewRoles),
            canConfigure: !loading && isAllowed(settings?.configRoles),
        }
    }, [loading, userData, settingsData])

    return (
        <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
    )
}

export const useAccess = () => useContext(AccessContext) ?? CLOSED
