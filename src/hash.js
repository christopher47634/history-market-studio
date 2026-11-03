// 共用的字符串哈希（djb2 变体），extendedCatalog 与 marketEngine 原先各抄了一份。
export const hashText = (text) =>
  [...text].reduce((sum, char) => ((sum * 33) ^ char.charCodeAt(0)) >>> 0, 5381);
