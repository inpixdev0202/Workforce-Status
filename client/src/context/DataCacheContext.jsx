import React, { createContext, useContext, useRef, useCallback } from 'react';
import { projectsAPI, employeesAPI } from '../api';

// Holds matrix + employees responses across route mounts so navigating away
// and back to 프로젝트 배정 doesn't re-fetch (matrix alone was 3-5s).
//
// Three pieces per cache entry:
//   - data:        last known data (kept fresh by setMatrixData on local edits)
//   - fetchedAt:   when we last hit the server (TTL applies to this only)
//   - promise:     in-flight Promise, so concurrent callers share one request
//
// Local edits (e.g. allocation blur) update `data` via setMatrixData but
// leave `fetchedAt` alone — so the TTL still forces a server refresh after
// 60s to pick up changes from other users.

const DataCacheContext = createContext(null);
const TTL_MS = 60_000;

export const DataCacheProvider = ({ children }) => {
    const matrixRef = useRef({ data: null, fetchedAt: 0, promise: null });
    const employeesRef = useRef(new Map()); // key: JSON.stringify(params)

    const getMatrix = useCallback(async ({ force = false } = {}) => {
        const cache = matrixRef.current;
        if (cache.promise) return cache.promise;
        if (!force && cache.data && (Date.now() - cache.fetchedAt) < TTL_MS) {
            return cache.data;
        }
        const promise = (async () => {
            try {
                const res = await projectsAPI.getMatrix();
                matrixRef.current = { data: res.data, fetchedAt: Date.now(), promise: null };
                return res.data;
            } catch (err) {
                matrixRef.current.promise = null;
                throw err;
            }
        })();
        matrixRef.current.promise = promise;
        return promise;
    }, []);

    const getEmployees = useCallback(async (params = {}, { force = false } = {}) => {
        const key = JSON.stringify(params);
        const cached = employeesRef.current.get(key);
        if (cached?.promise) return cached.promise;
        if (!force && cached?.data && (Date.now() - cached.fetchedAt) < TTL_MS) {
            return cached.data;
        }
        const promise = (async () => {
            try {
                const res = await employeesAPI.getAll(params);
                employeesRef.current.set(key, { data: res.data, fetchedAt: Date.now(), promise: null });
                return res.data;
            } catch (err) {
                const c = employeesRef.current.get(key);
                if (c) c.promise = null;
                throw err;
            }
        })();
        employeesRef.current.set(key, { ...(cached || { data: null, fetchedAt: 0 }), promise });
        return promise;
    }, []);

    // Synchronous reads — used for component initial state so a remount
    // can render previously-fetched data on the very first paint (no spinner).
    const getMatrixSync = useCallback(() => matrixRef.current.data, []);
    const getEmployeesSync = useCallback((params = {}) => {
        const key = JSON.stringify(params);
        return employeesRef.current.get(key)?.data || null;
    }, []);

    // Lets ProjectStatus push its locally-edited data into the cache so the
    // next mount sees the user's edits without a refetch.
    const setMatrixData = useCallback((data) => {
        const c = matrixRef.current;
        matrixRef.current = { ...c, data };
    }, []);

    const setEmployeesData = useCallback((params, data) => {
        const key = JSON.stringify(params);
        const c = employeesRef.current.get(key) || { fetchedAt: 0, promise: null };
        employeesRef.current.set(key, { ...c, data });
    }, []);

    const invalidateMatrix = useCallback(() => {
        matrixRef.current = { data: null, fetchedAt: 0, promise: null };
    }, []);

    const invalidateEmployees = useCallback(() => {
        employeesRef.current.clear();
    }, []);

    const invalidateAll = useCallback(() => {
        invalidateMatrix();
        invalidateEmployees();
    }, [invalidateMatrix, invalidateEmployees]);

    const value = {
        getMatrix,
        getEmployees,
        getMatrixSync,
        getEmployeesSync,
        setMatrixData,
        setEmployeesData,
        invalidateMatrix,
        invalidateEmployees,
        invalidateAll,
    };

    return (
        <DataCacheContext.Provider value={value}>
            {children}
        </DataCacheContext.Provider>
    );
};

export const useDataCache = () => {
    const ctx = useContext(DataCacheContext);
    if (!ctx) throw new Error('useDataCache must be used inside DataCacheProvider');
    return ctx;
};
