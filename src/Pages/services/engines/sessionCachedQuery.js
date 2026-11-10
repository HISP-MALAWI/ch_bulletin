import { useDataEngine } from '@dhis2/app-runtime';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    clearSessionResourceCache,
    getSessionCachedResource,
    getSessionResourceCacheValue,
} from '../../../utils/sessionResourceCache';

const initialStateFor = (cacheKey) => {
    const cached = getSessionResourceCacheValue(cacheKey);
    return cached.found
        ? { loading: false, error: undefined, data: cached.value }
        : { loading: true, error: undefined, data: undefined };
};

const useSessionCachedQuery = (query, cacheKey) => {
    const engine = useDataEngine();
    const requestId = useRef(0);
    const [state, setState] = useState(() => initialStateFor(cacheKey));

    const runQuery = useCallback(async (refresh = false) => {
        const currentRequestId = ++requestId.current;
        if (refresh) clearSessionResourceCache(cacheKey);

        const cached = getSessionResourceCacheValue(cacheKey);
        if (cached.found) {
            setState({ loading: false, error: undefined, data: cached.value });
            return cached.value;
        }

        setState((previous) => ({
            ...previous,
            loading: true,
            error: undefined,
        }));

        try {
            const data = await getSessionCachedResource(
                cacheKey,
                () => engine.query(query)
            );
            if (currentRequestId === requestId.current) {
                setState({ loading: false, error: undefined, data });
            }
            return data;
        } catch (error) {
            console.error(`Failed to load cached metadata "${cacheKey}":`, error);
            if (currentRequestId === requestId.current) {
                setState({ loading: false, error, data: undefined });
            }
            throw error;
        }
    }, [cacheKey, engine, query]);

    useEffect(() => {
        runQuery().catch(() => {});
        return () => {
            requestId.current += 1;
        };
    }, [runQuery]);

    const refetch = useCallback(() => runQuery(true), [runQuery]);
    return { ...state, refetch };
};

export default useSessionCachedQuery;
