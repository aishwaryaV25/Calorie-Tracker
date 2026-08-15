import Image from 'next/image';
import { cx } from '@/components/ui';

/**
 * The calligraphy C mark, optionally paired with the wordmark.
 *
 * The letterform is an image because a webfont cannot reproduce the brush
 * stroke; the name stays in type so it stays sharp at every size.
 */
export function BrandMark({
  size = 32,
  withName = true,
  nameClassName,
}: {
  size?: number;
  withName?: boolean;
  nameClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/brand/logo-mark.png"
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        priority
      />
      {withName && (
        <span className={cx('font-semibold tracking-tight text-foreground', nameClassName)}>
          Calorie Tracker
        </span>
      )}
    </span>
  );
}
