"use client";

import { forwardRef } from "react";
import { Button, type ButtonProps } from "./button";
import { Tooltip } from "./tooltip";

interface IconButtonProps extends Omit<ButtonProps, "aria-label"> {
  label: string;
  shortcut?: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
  hideTooltip?: boolean;
}

/** Icon-only button: always labelled for assistive tech, with a tooltip for sighted users. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, tooltipSide = "top", hideTooltip, variant = "ghost", size = "icon", ...props },
  ref,
) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide} disabled={hideTooltip}>
      <Button ref={ref} aria-label={label} variant={variant} size={size} {...props} />
    </Tooltip>
  );
});
