/**
 * Org-mode language definition for highlight.js
 */
export default function(hljs) {
  return {
    name: 'Org',
    aliases: ['org', 'org-mode', 'orgmode'],
    case_insensitive: true,
    contains: [
      // Headlines
      {
        className: 'section',
        begin: /^\*+\s/,
        end: /$/,
        contains: [
          {
            className: 'keyword',
            begin: /\b(TODO|DONE|WAITING|CANCELLED|NEXT|HOLD)\b/
          }
        ]
      },
      // Keywords (#+KEYWORD:)
      {
        className: 'meta',
        begin: /^#\+[A-Za-z_]+:/,
        end: /$/,
        contains: [
          {
            className: 'string',
            begin: /\s/,
            end: /$/
          }
        ]
      },
      // Begin/end blocks
      {
        className: 'keyword',
        begin: /^#\+(begin|end)_[a-z]+/i,
        relevance: 10
      },
      // Property drawers
      {
        className: 'attribute',
        begin: /^:\w+:/,
        end: /$/
      },
      // Links with description [[url][description]]
      {
        className: 'link',
        begin: /\[\[/,
        end: /\]\]/,
        contains: [
          {
            className: 'string',
            begin: /\]\[/,
            end: /(?=\]\])/
          }
        ]
      },
      // Bold
      {
        className: 'strong',
        begin: /\*[^\s*]/,
        end: /[^\s*]\*/,
        relevance: 0
      },
      // Italic
      {
        className: 'emphasis',
        begin: /\/[^\s/]/,
        end: /[^\s/]\//,
        relevance: 0
      },
      // Code/verbatim
      {
        className: 'code',
        begin: /[=~][^\s=~]/,
        end: /[^\s=~][=~]/,
        relevance: 0
      },
      // Comments (lines starting with #, but not #+)
      {
        className: 'comment',
        begin: /^#[^+]/,
        end: /$/
      },
      // Timestamps
      {
        className: 'number',
        begin: /<\d{4}-\d{2}-\d{2}/,
        end: />/
      },
      // Tags :tag1:tag2:
      {
        className: 'tag',
        begin: /\s:[a-zA-Z0-9_@#%:]+:\s*$/
      }
    ]
  };
}
