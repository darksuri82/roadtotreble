export type PixelStatusVariant = 'injury' | 'morale_high' | 'morale_low';

interface PixelStatusIconProps {
  variant: PixelStatusVariant;
  size?: number;
  title?: string;
  className?: string;
}

/**
 * Crisp 16x16 pixel-art SVG icons matching the game's retro pixel aesthetic:
 * - injury: bold medical red cross with white pixel border
 * - morale_high: blazing multi-tone pixel flame
 * - morale_low: frozen icy pixel crystal
 */
export function PixelStatusIcon({
  variant,
  size = 14,
  title,
  className = '',
}: PixelStatusIconProps) {
  if (variant === 'injury') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        role="img"
        aria-label={title ?? '부상'}
        className={`inline-block shrink-0 align-middle ${className}`}
      >
        {title ? <title>{title}</title> : null}
        {/* Outer dark shadow border */}
        <rect x="5" y="1" width="6" height="14" fill="#450a0a" />
        <rect x="1" y="5" width="14" height="6" fill="#450a0a" />
        {/* Crisp white medical border */}
        <rect x="6" y="2" width="4" height="12" fill="#f8fafc" />
        <rect x="2" y="6" width="12" height="4" fill="#f8fafc" />
        {/* Bright medical red cross core */}
        <rect x="7" y="3" width="2" height="10" fill="#ef4444" />
        <rect x="3" y="7" width="10" height="2" fill="#ef4444" />
        {/* Pixel highlight */}
        <rect x="7" y="3" width="1" height="3" fill="#fca5a5" />
        <rect x="3" y="7" width="3" height="1" fill="#fca5a5" />
      </svg>
    );
  }

  if (variant === 'morale_high') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        role="img"
        aria-label={title ?? '사기 최상'}
        className={`inline-block shrink-0 align-middle ${className}`}
      >
        {title ? <title>{title}</title> : null}
        {/* Outer red-orange flame */}
        <rect x="7" y="1" width="2" height="2" fill="#ef4444" />
        <rect x="6" y="3" width="4" height="2" fill="#ef4444" />
        <rect x="4" y="5" width="8" height="3" fill="#f97316" />
        <rect x="3" y="7" width="10" height="5" fill="#ef4444" />
        <rect x="4" y="12" width="8" height="2" fill="#dc2626" />
        <rect x="5" y="14" width="6" height="1" fill="#991b1b" />
        {/* Flicker tips */}
        <rect x="10" y="3" width="2" height="2" fill="#f97316" />
        <rect x="3" y="6" width="1" height="2" fill="#f97316" />
        {/* Middle orange-gold flame */}
        <rect x="6" y="5" width="4" height="7" fill="#fb923c" />
        <rect x="5" y="8" width="6" height="5" fill="#facc15" />
        {/* White-yellow blazing core */}
        <rect x="7" y="9" width="2" height="4" fill="#fef08a" />
        <rect x="7" y="11" width="2" height="2" fill="#ffffff" />
      </svg>
    );
  }

  // morale_low: icy pixel crystal
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? '사기 저조'}
      className={`inline-block shrink-0 align-middle ${className}`}
    >
      {title ? <title>{title}</title> : null}
      {/* Outer deep blue outline */}
      <rect x="7" y="1" width="2" height="14" fill="#0284c7" />
      <rect x="1" y="7" width="14" height="2" fill="#0284c7" />
      {/* Diagonal crystal branches */}
      <rect x="3" y="3" width="2" height="2" fill="#38bdf8" />
      <rect x="11" y="3" width="2" height="2" fill="#38bdf8" />
      <rect x="3" y="11" width="2" height="2" fill="#38bdf8" />
      <rect x="11" y="11" width="2" height="2" fill="#38bdf8" />
      <rect x="5" y="5" width="6" height="6" fill="#0ea5e9" />
      {/* Inner cyan frost */}
      <rect x="7" y="2" width="2" height="12" fill="#7dd3fc" />
      <rect x="2" y="7" width="12" height="2" fill="#7dd3fc" />
      <rect x="6" y="6" width="4" height="4" fill="#bae6fd" />
      {/* Bright ice core */}
      <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
      {/* Side frost tips */}
      <rect x="5" y="2" width="1" height="1" fill="#bae6fd" />
      <rect x="10" y="2" width="1" height="1" fill="#bae6fd" />
      <rect x="2" y="5" width="1" height="1" fill="#bae6fd" />
      <rect x="13" y="5" width="1" height="1" fill="#bae6fd" />
      <rect x="5" y="13" width="1" height="1" fill="#bae6fd" />
      <rect x="10" y="13" width="1" height="1" fill="#bae6fd" />
    </svg>
  );
}
