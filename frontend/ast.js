const fs = require('fs');
const parse5 = require('parse5');

const html = fs.readFileSync('template.html', 'utf8');
const doc = parse5.parseFragment(html, { sourceCodeLocationInfo: true });

function printTree(node, depth = 0) {
    if (node.nodeName === '#text' && node.value.trim() === '') return;
    
    let ind = '  '.repeat(depth);
    if (node.nodeName !== '#text' && !node.nodeName.startsWith('#')) {
        let attrs = node.attrs ? node.attrs.map(a => a.name + '="' + a.value + '"').join(' ') : '';
        let loc = node.sourceCodeLocation;
        let openLine = loc ? loc.startLine : '?';
        let closeLine = (loc && loc.endTag) ? loc.endTag.startLine : (loc && loc.startTag ? 'no-close' : '?');
        
        console.log(ind + '<' + node.nodeName + (attrs ? ' ' + attrs : '') + '> ' + '(L' + openLine + (closeLine !== 'no-close' ? '-' + closeLine : '') + (closeLine === 'no-close' ? ' UNCLOSED!' : '') + ')');
    }
    
    if (node.childNodes) {
        node.childNodes.forEach(child => printTree(child, depth + 1));
    }
}

printTree(doc);
