import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Box, IconButton, Tooltip, Typography, styled,
} from '@mui/material';
import {
    Close as CloseIcon,
    Minimize as MinimizeIcon,
    CheckBoxOutlineBlank as MaximizeIcon,
    CropFree as RestoreIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';

/* ── Styled components ───────────────────────────────────── */
const WindowRoot = styled(Box)(({ theme, $maximized, $focused }) => ({
    position: 'fixed',
    top: $maximized ? 0 : undefined,
    left: $maximized ? 0 : undefined,
    right: $maximized ? 0 : undefined,
    bottom: $maximized ? 0 : undefined,
    width: $maximized ? '100vw' : undefined,
    height: $maximized ? '100vh' : undefined,
    maxWidth: $maximized ? 'none' : undefined,
    maxHeight: $maximized ? 'none' : undefined,
    borderRadius: $maximized ? 0 : 3,
    boxShadow: $maximized ? theme.shadows[8] : theme.shadows[6],
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1000,
    transition: $maximized ? 'none' : 'box-shadow 0.15s, transform 0.15s',
    transform: $focused && !$maximized ? 'translateZ(0)' : undefined,
    '&:focus-within': {
        boxShadow: theme.shadows[8],
    },
}));

const TitleBar = styled(Box)(({ theme, $maximized, $focused }) => ({
    display: 'flex',
    alignItems: 'center',
    height: 36,
    padding: '0 12px',
    backgroundColor: $focused 
        ? alpha(theme.palette.primary.main, 0.08) 
        : 'transparent',
    borderBottom: `1px solid ${theme.palette.divider}`,
    borderRadius: $maximized ? 0 : '3px 3px 0 0',
    userSelect: 'none',
    cursor: 'default',
    transition: 'background-color 0.15s',
}));

const TitleBarButton = styled(IconButton)(({ theme }) => ({
    width: 28,
    height: 28,
    color: theme.palette.text.secondary,
    '&:hover': {
        backgroundColor: alpha(theme.palette.primary.main, 0.12),
        color: theme.palette.primary.main,
    },
    '&.close-btn:hover': {
        backgroundColor: '#e81123',
        color: '#fff',
    },
    transition: 'all 0.1s',
}));

function alpha(color, opacity) {
    return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
}

const ContentArea = styled(Box)(({ theme }) => ({
    flex: 1,
    overflow: 'auto',
    position: 'relative',
    backgroundColor: theme.palette.background.default,
}));

const ResizeHandle = styled(Box)(({ theme, position }) => {
    const base = {
        position: 'absolute',
        backgroundColor: 'transparent',
        zIndex: 10,
    };
    
    switch (position) {
        case 'se':
            return { ...base, right: 0, bottom: 0, width: 16, height: 16, cursor: 'se-resize' };
        case 's':
            return { ...base, bottom: 0, left: 8, right: 8, height: 6, cursor: 's-resize' };
        case 'e':
            return { ...base, right: 0, top: 8, bottom: 8, width: 6, cursor: 'e-resize' };
        case 'sw':
            return { ...base, left: 0, bottom: 0, width: 16, height: 16, cursor: 'sw-resize' };
        case 'w':
            return { ...base, left: 0, top: 8, bottom: 8, width: 6, cursor: 'w-resize' };
        case 'ne':
            return { ...base, right: 0, top: 0, width: 16, height: 16, cursor: 'ne-resize' };
        case 'n':
            return { ...base, top: 0, left: 8, right: 8, height: 6, cursor: 'n-resize' };
        case 'nw':
            return { ...base, left: 0, top: 0, width: 16, height: 16, cursor: 'nw-resize' };
        default:
            return base;
    }
});

/* ── Window Component ───────────────────────────────────── */
export function Window({ 
    id, 
    title, 
    icon: Icon, 
    children, 
    width, 
    height, 
    x, 
    y, 
    minimized, 
    maximized, 
    focused, 
    zIndex,
    onClose,
    onMinimize,
    onMaximize,
    onFocus,
    onGeometryChange,
    snapshot,
    onSnapshotChange,
    minWidth = 400,
    minHeight = 300,
    toolbar,
    showRefresh = false,
    onRefresh,
}) {
    const [dragging, setDragging] = useState(false);
    const [resizing, setResizing] = useState(null);
    const dragStartRef = useRef({ x: 0, y: 0, width, height });
    const titleBarRef = useRef(null);
    const contentRef = useRef(null);

    // Handle window drag
    const handleTitleBarMouseDown = useCallback((e) => {
        if (maximized) return;
        if (e.target.closest('button,[role="button"]')) return;
        
        onFocus(id);
        setDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            windowX: x,
            windowY: y,
        };
        e.preventDefault();
    }, [maximized, x, y, onFocus, id]);

    const handleTitleBarTouchStart = useCallback((e) => {
        if (maximized) return;
        if (e.target.closest('button,[role="button"]')) return;
        
        onFocus(id);
        const touch = e.touches[0];
        setDragging(true);
        dragStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            windowX: x,
            windowY: y,
        };
    }, [maximized, x, y, onFocus, id]);

    // Handle resize
    const handleResizeMouseDown = useCallback((e, edge) => {
        if (maximized) return;
        onFocus(id);
        setResizing(edge);
        const rect = contentRef.current?.getBoundingClientRect();
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            width: width || rect?.width || 900,
            height: height || rect?.height || 600,
            windowX: x,
            windowY: y,
        };
        e.preventDefault();
        e.stopPropagation();
    }, [maximized, width, height, x, y, onFocus, id]);

    const handleResizeTouchStart = useCallback((e, edge) => {
        if (maximized) return;
        onFocus(id);
        setResizing(edge);
        const touch = e.touches[0];
        const rect = contentRef.current?.getBoundingClientRect();
        dragStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            width: width || rect?.width || 900,
            height: height || rect?.height || 600,
            windowX: x,
            windowY: y,
        };
        e.stopPropagation();
    }, [maximized, width, height, x, y, onFocus, id]);

    // Global mouse/touch move
    useEffect(() => {
        const handleMove = (clientX, clientY) => {
            if (dragging) {
                const dx = clientX - dragStartRef.current.x;
                const dy = clientY - dragStartRef.current.y;
                const newX = Math.max(0, dragStartRef.current.windowX + dx);
                const newY = Math.max(0, dragStartRef.current.windowY + dy);
                onGeometryChange(id, { x: newX, y: newY });
            } else if (resizing) {
                const dx = clientX - dragStartRef.current.x;
                const dy = clientY - dragStartRef.current.y;
                let newWidth = dragStartRef.current.width;
                let newHeight = dragStartRef.current.height;
                let newX = dragStartRef.current.windowX;
                let newY = dragStartRef.current.windowY;

                if (resizing.includes('e')) newWidth = Math.max(minWidth, dragStartRef.current.width + dx);
                if (resizing.includes('w')) {
                    newWidth = Math.max(minWidth, dragStartRef.current.width - dx);
                    newX = dragStartRef.current.windowX + (dragStartRef.current.width - newWidth);
                }
                if (resizing.includes('s')) newHeight = Math.max(minHeight, dragStartRef.current.height + dy);
                if (resizing.includes('n')) {
                    newHeight = Math.max(minHeight, dragStartRef.current.height - dy);
                    newY = dragStartRef.current.windowY + (dragStartRef.current.height - newHeight);
                }

                onGeometryChange(id, { x: newX, y: newY, width: newWidth, height: newHeight });
            }
        };

        const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
        const handleTouchMove = (e) => {
            if (e.touches.length > 0) handleMove(e.touches[0].clientX, e.touches[0].clientY);
        };

        if (dragging || resizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.body.style.userSelect = 'none';
            document.body.style.cursor = resizing || (dragging ? 'move' : 'default');
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [dragging, resizing, id, minWidth, minHeight, onGeometryChange]);

    // Global mouse/touch up
    useEffect(() => {
        const handleUp = () => {
            if (dragging) setDragging(false);
            if (resizing) setResizing(null);
        };
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchend', handleUp);
        window.addEventListener('touchcancel', handleUp);
        return () => {
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
            window.removeEventListener('touchcancel', handleUp);
        };
    }, [dragging, resizing]);

    // Double-click title bar to maximize
    const handleTitleBarDoubleClick = useCallback(() => {
        if (!maximized) onMaximize(id);
    }, [maximized, onMaximize, id]);

    if (minimized) return null;

    const style = maximized ? {} : {
        left: x,
        top: y,
        width,
        height,
        zIndex,
    };

    return (
        <WindowRoot
            ref={contentRef}
            $maximized={maximized}
            $focused={focused}
            style={style}
            role="dialog"
            aria-label={title}
            tabIndex={0}
            onMouseDown={() => onFocus(id)}
            onTouchStart={() => onFocus(id)}
        >
            {/* Title Bar */}
            <TitleBar
                ref={titleBarRef}
                $maximized={maximized}
                $focused={focused}
                onMouseDown={handleTitleBarMouseDown}
                onTouchStart={handleTitleBarTouchStart}
                onDoubleClick={handleTitleBarDoubleClick}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    {Icon && <Icon sx={{ fontSize: 18, color: 'primary.main' }} />}
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {title}
                    </Typography>
                </Box>

                {/* Toolbar slot */}
                {toolbar && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, mr: 4 }}>
                        {toolbar}
                    </Box>
                )}

                {/* Window controls */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {showRefresh && onRefresh && (
                        <Tooltip title="Refresh">
                            <TitleBarButton onClick={onRefresh} aria-label="Refresh">
                                <RefreshIcon fontSize="small" />
                            </TitleBarButton>
                        </Tooltip>
                    )}
                    <Tooltip title={maximized ? 'Restore' : 'Maximize'}>
                        <TitleBarButton onClick={() => onMaximize(id)} aria-label={maximized ? 'Restore' : 'Maximize'}>
                            {maximized ? <RestoreIcon fontSize="small" /> : <MaximizeIcon fontSize="small" />}
                        </TitleBarButton>
                    </Tooltip>
                    <Tooltip title="Minimize">
                        <TitleBarButton onClick={() => onMinimize(id)} aria-label="Minimize">
                            <MinimizeIcon fontSize="small" />
                        </TitleBarButton>
                    </Tooltip>
                    <Tooltip title="Close">
                        <TitleBarButton className="close-btn" onClick={() => onClose(id)} aria-label="Close">
                            <CloseIcon fontSize="small" />
                        </TitleBarButton>
                    </Tooltip>
                </Box>
            </TitleBar>

            {/* Content */}
            <ContentArea>
                {children}
            </ContentArea>

            {/* Resize handles */}
            {!maximized && [
                ['nw', 'nw-resize'],
                ['n', 'n-resize'],
                ['ne', 'ne-resize'],
                ['e', 'e-resize'],
                ['se', 'se-resize'],
                ['s', 's-resize'],
                ['sw', 'sw-resize'],
                ['w', 'w-resize'],
            ].map(([pos, cursor]) => (
                <ResizeHandle
                    key={pos}
                    position={pos}
                    onMouseDown={(e) => handleResizeMouseDown(e, pos)}
                    onTouchStart={(e) => handleResizeTouchStart(e, pos)}
                    style={{ cursor }}
                />
            ))}
        </WindowRoot>
    );
}

export default Window;