/** Shared by the server layout (inline boot script) and the client preferences store. */
export const PREFS_KEY = "gh:prefs";

/**
 * Runs inline in <head> before first paint so the saved theme, motion and
 * quality preferences apply without a flash. Keep in sync with `apply()` in
 * lib/preferences.ts.
 */
export const PREFS_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("${PREFS_KEY}")||"{}");var t=p.theme||"dark";if(t==="system")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";var d=document.documentElement;d.dataset.theme=t;if(p.motion&&p.motion!=="system")d.dataset.motion=p.motion;d.dataset.quality=p.quality==="lofi"?"lofi":"hifi";var reduce=p.motion==="reduced"||(p.motion!=="full"&&matchMedia("(prefers-reduced-motion: reduce)").matches);var seen=false;try{seen=sessionStorage.getItem("gh:intro-seen")==="1"}catch(e){}if(seen||reduce||p.intro===false||p.quality==="lofi"||location.pathname.indexOf("/viewer")===0||location.pathname.indexOf("/chewy")===0)d.classList.add("intro-seen");if(!reduce){d.classList.add("motion-ready");setTimeout(function(){if(!window.__ghHydrated)d.classList.remove("motion-ready")},5000)}}catch(e){}})();`;
