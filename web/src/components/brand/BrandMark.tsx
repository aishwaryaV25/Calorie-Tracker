import Image from 'next/image';

export function BrandMark({
  size = 32,
  withName = true,
}: {
  size?: number;
  withName?: boolean;
}) {
  const tag = Math.max(8, Math.round(size * 0.22));
  const markWidth = Math.round(size * (536 / 660));

  return (
    <span className="inline-flex items-center leading-none" style={{ gap: 0 }}>
      <Image
        src="/brand/logo-c.png"
        alt={withName ? 'Calorie, by Typeface' : ''}
        width={markWidth}
        height={size}
        className="block object-contain"
        priority
      />
      {withName && (
        <span
          className="mb-[1px] whitespace-nowrap text-muted"
          style={{
            marginLeft: 2,
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: tag,
            letterSpacing: 0,
            lineHeight: 1,
          }}
        >
          by Typeface
        </span>
      )}
    </span>
  );
}
