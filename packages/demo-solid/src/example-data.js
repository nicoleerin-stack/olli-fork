import examplesMeta from '../../../docs/_data/examples.json';

const exampleModules = require.context('../../../docs/_includes/examples', false, /-vl\.html$/);

function extractScriptBody(exampleHtml) {
  return exampleHtml
    .replace(/<script[^>]*>/i, '')
    .replace(/<\/script>\s*$/i, '')
    .trim();
}

function findMatchingBrace(source, openingBraceIndex) {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (inSingleQuote) {
      if (char === '\'') {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inTemplate) {
      if (char === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === '\'') {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === '`') {
      inTemplate = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractSpecSource(exampleScript) {
  const assignmentPrefix = ['let spec =', 'const spec =', 'let baseSpec =', 'const baseSpec =']
    .find((prefix) => exampleScript.includes(prefix));

  if (!assignmentPrefix) {
    throw new Error('Could not identify the Vega-Lite spec assignment prefix.');
  }

  const assignmentIndex = exampleScript.indexOf(assignmentPrefix);
  const firstBraceIndex = exampleScript.indexOf('{', assignmentIndex + assignmentPrefix.length);

  if (firstBraceIndex < 0) {
    throw new Error('Could not find the start of the Vega-Lite spec object.');
  }

  const lastBraceIndex = findMatchingBrace(exampleScript, firstBraceIndex);

  if (lastBraceIndex < 0) {
    throw new Error('Could not find the end of the Vega-Lite spec object.');
  }

  return {
    specSource: exampleScript.slice(firstBraceIndex, lastBraceIndex + 1).trim(),
    contextSource: exampleScript.slice(0, lastBraceIndex + 1).trim(),
  };
}

function evaluateSpec(contextSource) {
  const sanitizedSource = contextSource
    .split('\n')
    .filter((line) => !line.trim().startsWith('import '))
    .join('\n');

  return Function(
    `"use strict";\n${sanitizedSource}\nreturn typeof baseSpec !== "undefined" ? baseSpec : spec;`
  )();
}

function getVegaLiteExamples() {
  return Object.entries(examplesMeta)
    .map(([id, entry]) => {
      const adapter = entry.adapters?.find((item) => item.name === 'Vega-Lite');

      if (!adapter) {
        return null;
      }

      const fileName = adapter.code.split('/').pop();
      const exampleHtml = exampleModules(`./${fileName}`);
      const exampleScript = extractScriptBody(exampleHtml);
      const { specSource, contextSource } = extractSpecSource(exampleScript);

      return {
        id,
        title: entry.title,
        galleryUrl: entry.url,
        codePath: fileName,
        developmentOnly: Boolean(entry.development_only),
        htmlSource: exampleHtml.trim(),
        specSource,
        spec: evaluateSpec(contextSource),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title));
}

export const vegaLiteExamples = getVegaLiteExamples();
