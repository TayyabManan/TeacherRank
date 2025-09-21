/**
 * Mobile utilities and responsive helpers
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Device detection utilities
export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth <= 768;
};

export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
};

export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Mobile detection hook
export const useMobileDetection = () => {
  const [mobile, setMobile] = useState(() => isMobile());
  const [touchDevice, setTouchDevice] = useState(() => isTouchDevice());

  useEffect(() => {
    const handleResize = () => {
      setMobile(isMobile());
      setTouchDevice(isTouchDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { mobile, touchDevice };
};

// Haptic feedback hook
export const useHaptic = () => {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        console.warn('Vibration failed:', error);
      }
    }
  }, []);

  return {
    light: () => vibrate(10),
    medium: () => vibrate(20),
    heavy: () => vibrate(50),
    success: () => vibrate([10, 50, 10]),
    error: () => vibrate([50, 100, 50]),
    swipe: () => vibrate(15),
    vibrate
  };
};

// Keyboard height detection
export const useKeyboardHeight = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!isMobile()) return;

    const handleResize = () => {
      const initialViewHeight = window.innerHeight;
      const currentViewHeight = window.visualViewport?.height || window.innerHeight;
      const heightDiff = initialViewHeight - currentViewHeight;
      
      setKeyboardHeight(heightDiff > 150 ? heightDiff : 0);
    };

    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > 0
  };
};

// Swipe gesture hook
interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export const useSwipeGesture = (
  elementRef: React.RefObject<HTMLElement>,
  callbacks?: SwipeCallbacks
) => {
  useEffect(() => {
    const element = elementRef.current;
    if (!element || !callbacks) return;

    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!e.changedTouches.length) return;
      
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      const minSwipeDistance = 50;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
          callbacks.onSwipeRight?.();
        } else {
          callbacks.onSwipeLeft?.();
        }
      } else if (Math.abs(deltaY) > minSwipeDistance) {
        if (deltaY > 0) {
          callbacks.onSwipeDown?.();
        } else {
          callbacks.onSwipeUp?.();
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, callbacks]);
};

// Pull to refresh hook
export const usePullToRefresh = (onRefresh: () => void) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isMobile()) return;

    let startY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;
      
      const currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY;
      
      if (pullDistance > 100 && !isRefreshing) {
        setIsRefreshing(true);
        onRefresh();
        setTimeout(() => setIsRefreshing(false), 1000);
      }
    };

    const handleTouchEnd = () => {
      isPulling = false;
      startY = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, isRefreshing]);

  return { isRefreshing };
};