interface RightMenuPolicyInput {
  localEnabled: boolean;
  siteDisabled: boolean;
  pathname: string;
  viewportWidth: number;
}

export function shouldUseSiteRightMenu({
  localEnabled,
  siteDisabled,
  pathname,
  viewportWidth,
}: RightMenuPolicyInput): boolean {
  return localEnabled && !siteDisabled && !pathname.startsWith("/doc/") && viewportWidth >= 768;
}
