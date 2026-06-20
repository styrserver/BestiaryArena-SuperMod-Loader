// Shared extension resource URL helpers (content scripts, page context, service worker).
(function(global) {
  'use strict';

  function encodePathSegments(path) {
    return String(path).split('/').map((segment) => {
      if (!segment) return segment;
      try {
        segment = decodeURIComponent(segment);
      } catch {
        // keep segment as-is if not valid URI encoding
      }
      return encodeURIComponent(segment);
    }).join('/');
  }

  function splitExtensionResourceUrl(url) {
    const match = String(url).match(/^([a-z][a-z0-9+.-]*:\/\/[^/]+)(\/.*)?$/i);
    if (!match) return null;
    return { origin: match[1], pathname: match[2] || '' };
  }

  function normalizeExtensionResourceUrl(url) {
    if (!url || typeof url !== 'string') return url;

    try {
      const parsed = new URL(url);
      const encodedPath = encodePathSegments(parsed.pathname);
      if (encodedPath !== parsed.pathname) {
        return parsed.origin + encodedPath + parsed.search + parsed.hash;
      }
      return url;
    } catch {
      // WebKit/Firefox iOS: URL() rejects extension URLs with unencoded spaces in the path.
      const parts = splitExtensionResourceUrl(url);
      if (parts) {
        const encodedPath = encodePathSegments(parts.pathname);
        if (encodedPath !== parts.pathname) {
          return parts.origin + encodedPath;
        }
      }
      return url;
    }
  }

  function joinExtensionBaseUrl(baseUrl, relativePath) {
    if (!baseUrl) return relativePath || '';
    if (!relativePath) return baseUrl;
    const path = encodePathSegments(String(relativePath).replace(/^\//, ''));
    return baseUrl.endsWith('/') ? baseUrl + path : baseUrl + '/' + path;
  }

  function toFilesystemFilename(filename) {
    return String(filename).replace(/ /g, '_');
  }

  function toFilesystemBundledModPath(modName) {
    if (!modName || typeof modName !== 'string') return modName;
    let path = modName
      .replace(/^mods\/Official Mods\//, 'mods/Official_Mods/')
      .replace(/^mods\/Super Mods\//, 'mods/Super_Mods/')
      .replace(/^mods\/OT Mods\//, 'mods/OT_Mods/')
      .replace(/^Official Mods\//, 'Official_Mods/')
      .replace(/^Super Mods\//, 'Super_Mods/')
      .replace(/^OT Mods\//, 'OT_Mods/');
    const parts = path.split('/');
    const file = parts.pop();
    if (file) {
      parts.push(toFilesystemFilename(file));
    }
    return parts.join('/');
  }

  function resolveBundledModPath(modName) {
    if (!modName || typeof modName !== 'string') {
      throw new Error('Invalid mod name');
    }
    const filesystemPath = toFilesystemBundledModPath(modName);
    if (filesystemPath.startsWith('database/') || filesystemPath.startsWith('mods/')) {
      return filesystemPath;
    }
    return `mods/${filesystemPath}`;
  }

  function getExtensionResourceUrl(getURL, logicalPath) {
    if (typeof getURL !== 'function' || !logicalPath) return '';
    return normalizeExtensionResourceUrl(getURL(logicalPath));
  }

  function fetchExtensionResourceTextViaXhr(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'text';
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
          return;
        }
        reject(new Error(`XHR HTTP ${xhr.status} for ${url}`));
      };
      xhr.onerror = function() {
        reject(new Error(`XHR load failed for ${url}`));
      };
      xhr.send();
    });
  }

  async function fetchExtensionResourceText(getURL, logicalPath) {
    const url = getExtensionResourceUrl(getURL, logicalPath);
    if (!url) {
      throw new Error(`Invalid extension resource path: ${logicalPath}`);
    }

    let fetchError = null;
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.text();
      }
      fetchError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      fetchError = error instanceof Error ? error : new Error(String(error));
    }

    try {
      return await fetchExtensionResourceTextViaXhr(url);
    } catch (xhrError) {
      const detail = fetchError?.message || String(fetchError);
      const xhrDetail = xhrError instanceof Error ? xhrError.message : String(xhrError);
      throw new Error(`${detail}; ${xhrDetail}`);
    }
  }

  // Bundled .mjs files are IIFEs without import/export; WebKit rejects type="module" loads.
  function scriptLoadTypeForFile() {
    return 'text/javascript';
  }

  function formatScriptLoadError(error, scriptUrl) {
    if (error instanceof Event) {
      return scriptUrl ? `Script load failed: ${scriptUrl}` : 'Script load failed';
    }
    return error != null ? String(error) : 'Unknown script load error';
  }

  global.BestiaryExtensionUrl = {
    encodePathSegments,
    normalizeExtensionResourceUrl,
    joinExtensionBaseUrl,
    toFilesystemBundledModPath,
    resolveBundledModPath,
    getExtensionResourceUrl,
    fetchExtensionResourceText,
    scriptLoadTypeForFile,
    formatScriptLoadError
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
