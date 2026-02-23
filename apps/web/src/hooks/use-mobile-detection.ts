'use client';

import { useEffect, useState } from 'react';

type DeviceType = 'mobile' | 'tablet' | 'desktop';

type MobileDetection = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: DeviceType;
};

/**
 * Hook to detect the current device type based on viewport width.
 * Uses Tailwind CSS breakpoints:
 * - Mobile: < 768px
 * - Tablet: 768px - 1024px
 * - Desktop: >= 1024px
 *
 * @returns MobileDetection object with device type flags
 */
export function useMobileDetection(): MobileDetection {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    // SSR safe: default to desktop during server-side rendering
    if (typeof window === 'undefined') {
      return 'desktop';
    }
    return getDeviceType();
  });

  useEffect(() => {
    // Skip if window is not available (SSR)
    if (typeof window === 'undefined') {
      return;
    }

    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');

    const handleResize = (): void => {
      setDeviceType(getDeviceType());
    };

    // Add event listeners for both queries
    mobileQuery.addEventListener('change', handleResize);
    tabletQuery.addEventListener('change', handleResize);

    // Set initial value
    handleResize();

    // Cleanup event listeners
    return () => {
      mobileQuery.removeEventListener('change', handleResize);
      tabletQuery.removeEventListener('change', handleResize);
    };
  }, []);

  return {
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    deviceType,
  };
}

/**
 * Helper function to determine device type based on current window width
 */
function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') {
    return 'desktop';
  }

  const width = window.innerWidth;

  if (width < 768) {
    return 'mobile';
  }
  if (width < 1024) {
    return 'tablet';
  }
  return 'desktop';
}
