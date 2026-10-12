const fs = require('fs');
const path = require('path');

// 1. Patch pages-manifest-plugin.js
const targetPlugin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'build', 'webpack', 'plugins', 'pages-manifest-plugin.js');
if (fs.existsSync(targetPlugin)) {
  let content = fs.readFileSync(targetPlugin, 'utf8');

  // Replace entrypoint handling with normalized route + page handling
  const oldSnippetRegex = /(?:const normalizedPage = [^;]*;[\s\S]*?pages\[pagePath\] = file;[\s\S]*?\}|if\s*\(entrypoint\.name\.startsWith\("app\/"\)[^}]*appPaths\[pagePath\]\s*=\s*file;[\s\S]*?pages\[pagePath\]\s*=\s*file;\s*\})/;
  const newSnippet = `const normalizedPage = (0, _normalizepathsep.normalizePathSep)(pagePath).replace(/\\/+/g, "/");
            if (entrypoint.name.startsWith("app/") || entrypoint.name.startsWith("app\\\\")) {
                appPaths[pagePath] = file;
                appPaths[normalizedPage] = file;
                if (normalizedPage.endsWith("/page")) {
                    appPaths[normalizedPage.slice(0, -5) || "/"] = file;
                }
                if (normalizedPage.endsWith("/route")) {
                    appPaths[normalizedPage.slice(0, -6) || "/"] = file;
                }
            } else {
                pages[pagePath] = file;
                pages[normalizedPage] = file;
            }`;

  if (oldSnippetRegex.test(content)) {
    content = content.replace(oldSnippetRegex, newSnippet);
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
  }

  fs.writeFileSync(targetPlugin, content, 'utf8');
  console.log('[patch-next] Successfully applied pages-manifest-plugin patch.');
}

// 2. Patch require.js
const targetRequire = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'server', 'require.js');
if (fs.existsSync(targetRequire)) {
  let content = fs.readFileSync(targetRequire, 'utf8');

  // Check manifest for /page and /route
  const checkManifestRegex = /let curPath = manifest\[page\][^;]*;/;
  content = content.replace(
    checkManifestRegex,
    'let curPath = manifest[page] || manifest[`${page}/page`] || manifest[`${page}/route`] || manifest[page.replace(/\\/page$/, "")] || manifest[page.replace(/\\/route$/, "")];'
  );

  // Check candidates for route.js as well without duplicate cleanPage declaration
  const candidatesRegex = /(?:const cleanPage = page\.replace\(\/\^\\\/\\?\+\/, ""\);\s*)*const candidates = \[[^\]]*\];/;
  const newCandidates = `const candidates = [
            _path.default.join(serverBuildPath, "app", cleanPage === "" ? "page.js" : \`\${cleanPage}/page.js\`),
            _path.default.join(serverBuildPath, "app", cleanPage === "" ? "route.js" : \`\${cleanPage}/route.js\`),
            _path.default.join(serverBuildPath, "app", \`\${cleanPage}.js\`),
            _path.default.join(serverBuildPath, "app", \`\${cleanPage}\`, "page.js"),
            _path.default.join(serverBuildPath, "app", \`\${cleanPage}\`, "route.js"),
            _path.default.join(serverBuildPath, "pages", \`\${cleanPage}.js\`),
            _path.default.join(serverBuildPath, \`\${cleanPage}.js\`)
        ];`;

  // First remove duplicated cleanPage if present
  content = content.replace('const cleanPage = page.replace(/^\\/+/, "");\n        const cleanPage = page.replace(/^\\/+/, "");', 'const cleanPage = page.replace(/^\\/+/, "");');
  if (candidatesRegex.test(content)) {
    content = content.replace(candidatesRegex, newCandidates);
  }

  fs.writeFileSync(targetRequire, content, 'utf8');
  console.log('[patch-next] Successfully applied require.js manifest patch.');
}
