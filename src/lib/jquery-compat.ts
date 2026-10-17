/**
 * Polyfill API jQuery 3 yang dihapus di jQuery 4,
 * agar plugin lama (Summernote, Select2) tetap jalan.
 *
 * Summernote 0.9 masih memanggil jQuery.nodeName saat toggle list (ul/ol).
 */
export function patchJqueryCompat(jq: JQueryStatic): JQueryStatic {
  const patched = jq as JQueryStatic & {
    now?: () => number;
    isArray?: typeof Array.isArray;
    isFunction?: (value: unknown) => boolean;
    trim?: (text: string) => string;
    parseJSON?: typeof JSON.parse;
    nodeName?: (elem: { nodeName?: string } | null | undefined, name: string) => boolean;
    type?: (obj: unknown) => string;
  };

  if (typeof patched.now !== "function") patched.now = Date.now;
  if (typeof patched.isArray !== "function") patched.isArray = Array.isArray;
  if (typeof patched.isFunction !== "function") {
    patched.isFunction = (value) => typeof value === "function";
  }
  if (typeof patched.trim !== "function") {
    patched.trim = (text) => (text == null ? "" : String(text).trim());
  }
  if (typeof patched.parseJSON !== "function") patched.parseJSON = JSON.parse;
  if (typeof patched.nodeName !== "function") {
    patched.nodeName = (elem, name) =>
      !!elem?.nodeName && elem.nodeName.toLowerCase() === String(name).toLowerCase();
  }
  if (typeof patched.type !== "function") {
    patched.type = (obj) => {
      if (obj == null) return `${obj}`;
      const matched = Object.prototype.toString.call(obj).match(/\s([a-zA-Z]+)/);
      return matched ? matched[1].toLowerCase() : typeof obj;
    };
  }

  return jq;
}
