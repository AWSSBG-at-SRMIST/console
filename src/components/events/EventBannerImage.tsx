'use client';

import { useState } from 'react';
import {
  convertGoogleDriveUrlToPreview,
  extractGoogleDriveFileId,
  getGoogleDriveFallbackPreviewUrl,
} from '@/lib/utils';

interface EventBannerImageProps {
  url: string;
  alt: string;
  className?: string;
  width?: number;
  onError?: () => void;
}

export function EventBannerImage(props: EventBannerImageProps) {
  return <BannerInner key={`${props.url}-${props.width ?? 400}`} {...props} />;
}

function BannerInner({ url, alt, className, width = 400, onError }: EventBannerImageProps) {
  const fileId = extractGoogleDriveFileId(url);
  const primary = convertGoogleDriveUrlToPreview(url, width);
  const fallback = fileId ? getGoogleDriveFallbackPreviewUrl(fileId, width) : '';
  const [useFallback, setUseFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = useFallback && fallback ? fallback : primary;

  if (failed) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!useFallback && fallback && fallback !== primary) {
          setUseFallback(true);
          return;
        }
        setFailed(true);
        onError?.();
      }}
    />
  );
}
