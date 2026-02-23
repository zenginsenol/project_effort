'use client';

import { useCallback, useEffect, useState } from 'react';

interface UseKeyboardShortcutOptions {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

interface UseKeyboardShortcutReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Hook to handle keyboard shortcuts with Cmd+K (Mac) and Ctrl+K (Windows/Linux)
 * @param options - Keyboard shortcut configuration
 * @returns Object with isOpen state and control functions
 */
export function useKeyboardShortcut(
  options: UseKeyboardShortcutOptions = { key: 'k', ctrlKey: true, metaKey: true }
): UseKeyboardShortcutReturn {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const { key, ctrlKey = false, metaKey = false, shiftKey = false, altKey = false } = options;

      // Check if the key matches
      if (event.key.toLowerCase() !== key.toLowerCase()) {
        return;
      }

      // Check modifier keys - support both Cmd (Mac) and Ctrl (Windows/Linux)
      const isModifierMatch =
        (metaKey && event.metaKey) || // Cmd key on Mac
        (ctrlKey && event.ctrlKey);   // Ctrl key on Windows/Linux

      if (!isModifierMatch) {
        return;
      }

      // Check optional modifiers
      if (shiftKey !== undefined && event.shiftKey !== shiftKey) {
        return;
      }

      if (altKey !== undefined && event.altKey !== altKey) {
        return;
      }

      // Prevent default browser behavior (e.g., Ctrl+K opens browser search)
      event.preventDefault();
      event.stopPropagation();

      // Toggle the state
      toggle();
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [options, toggle]);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}
