import { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';

const WindowManagerContext = createContext(null);

const initialState = {
    windows: {},
    zIndexCounter: 1000,
    taskbarOrder: [],
    activeWindowId: null,
};

const WINDOW_DEFAULTS = {
    width: 900,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    x: 'center',
    y: 'center',
};

function windowManagerReducer(state, action) {
    switch (action.type) {
        case 'OPEN_WINDOW': {
            const { windowId, config } = action.payload;
            const existingWindow = state.windows[windowId];
            
            if (existingWindow) {
                // Window exists - focus it and restore if minimized
                const updates = {
                    minimized: false,
                    focused: true,
                    zIndex: state.zIndexCounter + 1,
                };
                // If maximized was true, keep it
                if (existingWindow.maximized) updates.maximized = true;
                
                return {
                    ...state,
                    windows: {
                        ...state.windows,
                        [windowId]: { ...existingWindow, ...updates },
                    },
                    zIndexCounter: state.zIndexCounter + 1,
                    activeWindowId: windowId,
                    taskbarOrder: [...state.taskbarOrder.filter(id => id !== windowId), windowId],
                };
            }

            // Calculate centered position
            const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
            const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
            const width = config.width || WINDOW_DEFAULTS.width;
            const height = config.height || WINDOW_DEFAULTS.height;
            const x = config.x === 'center' ? (screenWidth - width) / 2 : config.x;
            const y = config.y === 'center' ? (screenHeight - height) / 2 : config.y;

            const newWindow = {
                id: windowId,
                title: config.title,
                icon: config.icon,
                component: config.component,
                props: config.props || {},
                width,
                height,
                x: Math.max(0, Math.min(x, screenWidth - 100)),
                y: Math.max(0, Math.min(y, screenHeight - 100)),
                minimized: false,
                maximized: false,
                focused: true,
                zIndex: state.zIndexCounter + 1,
                prevState: null, // for restore from maximized
                snapshot: null, // for filter/form state persistence
            };

            return {
                ...state,
                windows: { ...state.windows, [windowId]: newWindow },
                zIndexCounter: state.zIndexCounter + 1,
                activeWindowId: windowId,
                taskbarOrder: [...state.taskbarOrder, windowId],
            };
        }

        case 'CLOSE_WINDOW': {
            const { windowId } = action.payload;
            const newWindows = { ...state.windows };
            delete newWindows[windowId];
            
            let newActiveId = state.activeWindowId;
            if (state.activeWindowId === windowId) {
                // Focus the most recently used window
                const remaining = state.taskbarOrder.filter(id => id !== windowId && newWindows[id]);
                newActiveId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
            }
            
            return {
                ...state,
                windows: newWindows,
                activeWindowId: newActiveId,
                taskbarOrder: state.taskbarOrder.filter(id => id !== windowId),
            };
        }

        case 'MINIMIZE_WINDOW': {
            const { windowId } = action.payload;
            const win = state.windows[windowId];
            if (!win) return state;
            
            return {
                ...state,
                windows: {
                    ...state.windows,
                    [windowId]: { ...win, minimized: true, focused: false },
                },
                activeWindowId: state.activeWindowId === windowId ? null : state.activeWindowId,
            };
        }

        case 'MAXIMIZE_WINDOW': {
            const { windowId } = action.payload;
            const win = state.windows[windowId];
            if (!win) return state;
            
            if (win.maximized) {
                // Restore
                return {
                    ...state,
                    windows: {
                        ...state.windows,
                        [windowId]: { 
                            ...win, 
                            maximized: false,
                            x: win.prevState?.x ?? win.x,
                            y: win.prevState?.y ?? win.y,
                            width: win.prevState?.width ?? win.width,
                            height: win.prevState?.height ?? win.height,
                            prevState: null,
                        },
                    },
                };
            } else {
                // Maximize
                return {
                    ...state,
                    windows: {
                        ...state.windows,
                        [windowId]: { 
                            ...win, 
                            maximized: true,
                            prevState: { x: win.x, y: win.y, width: win.width, height: win.height },
                        },
                    },
                };
            }
        }

        case 'FOCUS_WINDOW': {
            const { windowId } = action.payload;
            const win = state.windows[windowId];
            if (!win) return state;
            
            const updates = {
                minimized: false,
                focused: true,
                zIndex: state.zIndexCounter + 1,
            };

            return {
                ...state,
                windows: {
                    ...state.windows,
                    [windowId]: { ...win, ...updates },
                    ...(state.activeWindowId && state.activeWindowId !== windowId ? {
                        [state.activeWindowId]: { 
                            ...state.windows[state.activeWindowId], 
                            focused: false 
                        }
                    } : {}),
                },
                zIndexCounter: state.zIndexCounter + 1,
                activeWindowId: windowId,
                taskbarOrder: [...state.taskbarOrder.filter(id => id !== windowId), windowId],
            };
        }

        case 'UPDATE_WINDOW_GEOMETRY': {
            const { windowId, geometry } = action.payload;
            const win = state.windows[windowId];
            if (!win || win.maximized) return state;
            
            return {
                ...state,
                windows: {
                    ...state.windows,
                    [windowId]: { 
                        ...win, 
                        x: geometry.x ?? win.x,
                        y: geometry.y ?? win.y,
                        width: geometry.width ?? win.width,
                        height: geometry.height ?? win.height,
                    },
                },
            };
        }

        case 'SET_WINDOW_SNAPSHOT': {
            const { windowId, snapshot } = action.payload;
            const win = state.windows[windowId];
            if (!win) return state;
            
            return {
                ...state,
                windows: {
                    ...state.windows,
                    [windowId]: { ...win, snapshot },
                },
            };
        }

        case 'RESTORE_WINDOW_SNAPSHOT': {
            const { windowId } = action.payload;
            const win = state.windows[windowId];
            if (!win) return state;
            return state; // snapshot is read by component, not applied here
        }

        case 'REORDER_TASKBAR': {
            const { fromIndex, toIndex } = action.payload;
            const newOrder = [...state.taskbarOrder];
            const [removed] = newOrder.splice(fromIndex, 1);
            newOrder.splice(toIndex, 0, removed);
            return { ...state, taskbarOrder: newOrder };
        }

        case 'LOAD_PERSISTED_STATE': {
            return { ...state, ...action.payload };
        }

        default:
            return state;
    }
}

export function WindowManagerProvider({ children }) {
    const [state, dispatch] = useReducer(windowManagerReducer, initialState);

    // Persist state to localStorage
    useEffect(() => {
        const saved = localStorage.getItem('bisnoc-window-state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Only restore window geometry and taskbar order, not component instances
                dispatch({
                    type: 'LOAD_PERSISTED_STATE',
                    payload: {
                        taskbarOrder: parsed.taskbarOrder || [],
                        // Windows will be reopened by the app, we just restore geometry preferences
                    },
                });
            } catch (e) {
                console.warn('Failed to parse window state:', e);
            }
        }
    }, []);

    // Save state on changes
    useEffect(() => {
        const toSave = {
            taskbarOrder: state.taskbarOrder,
            windows: Object.fromEntries(
                Object.entries(state.windows).map(([id, win]) => [
                    id,
                    {
                        x: win.x,
                        y: win.y,
                        width: win.width,
                        height: win.height,
                        maximized: win.maximized,
                        minimized: win.minimized,
                        snapshot: win.snapshot, // persist filter/form state
                    },
                ])
            ),
        };
        localStorage.setItem('bisnoc-window-state', JSON.stringify(toSave));
    }, [state.windows, state.taskbarOrder]);

    // Actions
    const openWindow = useCallback((windowId, config) => {
        dispatch({ type: 'OPEN_WINDOW', payload: { windowId, config } });
    }, []);

    const closeWindow = useCallback((windowId) => {
        dispatch({ type: 'CLOSE_WINDOW', payload: { windowId } });
    }, []);

    const minimizeWindow = useCallback((windowId) => {
        dispatch({ type: 'MINIMIZE_WINDOW', payload: { windowId } });
    }, []);

    const maximizeWindow = useCallback((windowId) => {
        dispatch({ type: 'MAXIMIZE_WINDOW', payload: { windowId } });
    }, []);

    const focusWindow = useCallback((windowId) => {
        dispatch({ type: 'FOCUS_WINDOW', payload: { windowId } });
    }, []);

    const updateWindowGeometry = useCallback((windowId, geometry) => {
        dispatch({ type: 'UPDATE_WINDOW_GEOMETRY', payload: { windowId, geometry } });
    }, []);

    const setWindowSnapshot = useCallback((windowId, snapshot) => {
        dispatch({ type: 'SET_WINDOW_SNAPSHOT', payload: { windowId, snapshot } });
    }, []);

    const getWindowSnapshot = useCallback((windowId) => {
        return state.windows[windowId]?.snapshot || null;
    }, [state.windows]);

    const value = useMemo(() => ({
        windows: state.windows,
        activeWindowId: state.activeWindowId,
        taskbarOrder: state.taskbarOrder,
        openWindow,
        closeWindow,
        minimizeWindow,
        maximizeWindow,
        focusWindow,
        updateWindowGeometry,
        setWindowSnapshot,
        getWindowSnapshot,
    }), [state.windows, state.activeWindowId, state.taskbarOrder, openWindow, closeWindow, minimizeWindow, maximizeWindow, focusWindow, updateWindowGeometry, setWindowSnapshot, getWindowSnapshot]);

    return (
        <WindowManagerContext.Provider value={value}>
            {children}
        </WindowManagerContext.Provider>
    );
}

export function useWindowManager() {
    const context = useContext(WindowManagerContext);
    if (!context) {
        throw new Error('useWindowManager must be used within WindowManagerProvider');
    }
    return context;
}

// Helper to generate window IDs from route
export function getWindowIdFromRoute(pathname) {
    // Strip /app prefix and normalize
    const route = pathname.replace('/app', '') || '/dashboard';
    return `win-${route.replace(/\//g, '-').replace(/^-|-$/g, '')}`;
}