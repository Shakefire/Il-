const fs = require('fs');
const path = require('path');

// 1. Patch pages-manifest-plugin.js
const targetPlugin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'build', 'webpack', 'plugins', 'pages-manifest-plugin.js');
if (fs.existsSync(targetPlugin)) {
  let content = fs.readFileSync(targetPlugin, 'utf8');
  let modified = false;

  if (content.includes('if (entrypoint.name.startsWith("app/")) {')) {
    content = content.replace(
      'if (entrypoint.name.startsWith("app/")) {',
      'if (entrypoint.name.startsWith("app/") || entrypoint.name.startsWith("app\\\\")) {'
    );
    modified = true;
  }

  if (!content.includes('appPaths[pagePath.slice(0, -5) || "/"] = file;')) {
    content = content.replace(
      'appPaths[pagePath] = file;',
      'appPaths[pagePath] = file;\n                if (pagePath.endsWith("/page")) {\n                    appPaths[pagePath.slice(0, -5) || "/"] = file;\n                }'
    );
    modified = true;
  }

  if (content.includes('nodeServerAppPaths = appPaths;')) {
    content = content.replace(
      'nodeServerPages = pages;\n            nodeServerAppPaths = appPaths;',
      'nodeServerPages = { ...nodeServerPages, ...pages };\n            nodeServerAppPaths = { ...nodeServerAppPaths, ...appPaths };'
    );
    content = content.replace(
      'edgeServerPages = pages;\n            edgeServerAppPaths = appPaths;',
      'edgeServerPages = { ...edgeServerPages, ...pages };\n            edgeServerAppPaths = { ...edgeServerAppPaths, ...appPaths };'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(targetPlugin, content, 'utf8');
    console.log('[patch-next] Successfully applied pages-manifest-plugin patch.');
  }
}

// 2. Patch require.js
const targetRequire = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'server', 'require.js');
if (fs.existsSync(targetRequire)) {
  let content = fs.readFileSync(targetRequire, 'utf8');
  let modified = false;

  if (content.includes('let curPath = manifest[page];')) {
    content = content.replace(
      'let curPath = manifest[page];',
      'let curPath = manifest[page] || manifest[`${page}/page`] || manifest[page.replace(/\\/page$/, "")];'
    );
    modified = true;
  }

  if (!content.includes('const cleanPage = page.replace(/^\\/+/, "");')) {
    content = content.replace(
      'if (!pagePath) {\n        pagePathCache == null ? void 0 : pagePathCache.set(cacheKey, null);\n        return null;\n    }',
      'if (!pagePath) {\n        const cleanPage = page.replace(/^\\/+/, "");\n        const candidates = [\n            _path.default.join(serverBuildPath, "app", `${cleanPage}.js`),\n            _path.default.join(serverBuildPath, "app", `${cleanPage}`, "page.js"),\n            _path.default.join(serverBuildPath, "app", cleanPage === "" ? "page.js" : `${cleanPage}/page.js`)\n        ];\n        for (const candidate of candidates) {\n            if (_fs.existsSync(candidate)) {\n                pagePath = _path.default.relative(serverBuildPath, candidate).replace(/\\\\/g, "/");\n                break;\n            }\n        }\n    }\n    if (!pagePath) {\n        pagePathCache == null ? void 0 : pagePathCache.set(cacheKey, null);\n        return null;\n    }'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(targetRequire, content, 'utf8');
    console.log('[patch-next] Successfully applied require.js manifest patch.');
  }
}
