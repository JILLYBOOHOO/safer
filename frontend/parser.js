const fs = require('fs');
const html = fs.readFileSync('template.html', 'utf8');
const lines = html.split(/\r?\n/);
let tags = [];
let regex = /<(\/?)(main|div|ng-container|button|p|span|h2|h3|h4|ul|li|strong|i|input|img|br|hr)[^>]*>/gi;
const voidElements = new Set(['input', 'img', 'br', 'hr', 'meta']);

for (let i = 0; i < lines.length; i++) {
  let lineText = lines[i];
  let m;
  while ((m = regex.exec(lineText)) !== null) {
    const isClosing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const fullMatch = m[0];
    const lineNum = i + 1;
    
    // Ignore self-closing and void elements
    if (fullMatch.endsWith('/>') || (!isClosing && voidElements.has(tag))) continue;
    
    if (!isClosing) {
      tags.push({tag, line: lineNum});
    } else {
      if (tags.length === 0) {
        console.log('Unexpected closing tag', tag, 'at line', lineNum);
      } else {
        let last = tags.pop();
        if (last.tag !== tag) {
          console.log('Mismatched tags: expected </' + last.tag + '> (opened on line ' + last.line + ') but found </' + tag + '> at line ' + lineNum);
          tags.push(last);
        }
      }
    }
  }
}

if (tags.length > 0) {
  console.log('Unclosed tags remaining:');
  tags.forEach(t => console.log('  ' + t.tag + ' at line ' + t.line));
} else {
  console.log('All tags balanced!');
}
