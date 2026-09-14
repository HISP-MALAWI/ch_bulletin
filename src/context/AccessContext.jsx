import React, { createContext, useContext, useMemo } from 'react'
import { useDataQuery } from '@dhis2/app-runtime'

const ACCESS_QUERY = {
    me: {
        resource: 'me',
        params: {
            fields: 'id,displayName,userGroups[id,displayName],userRoles[id,displayName]',
        },
    },
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
    const { loading, data } = useDataQuery(ACCESS_QUERY)

    const value = useMemo(() => {
        const me = data?.me
        const settings = data?.settings

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
    }, [loading, data])

    return (
        <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
    )
}

export const useAccess = () => useContext(AccessContext) ?? CLOSED
