import type { FC, ReactNode } from "react";

export const MobileRail: FC<{
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}> = ({ children, className = "", innerClassName = "" }) => {
  const innerClasses = `flex flex-wrap gap-3 sm:flex-nowrap ${innerClassName}`;
  return (
    <div
      className={`w-full flex-wrap px-3 pb-2 sm:-mx-3 sm:overflow-x-auto sm:snap-x sm:snap-mandatory ${className}`}
    >
      <div className={innerClasses}>{children}</div>
    </div>
  );
};
