const fs = require('fs');
const code = fs.readFileSync('src/modules/seller/pages/ProductManagement.jsx', 'utf8');

let stack = [];
let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for (let j = 0; j < line.length; j++) {
    let char = line[j];
    if (char === '{' || char === '(' || char === '[') {
      stack.push({ char, line: i + 1, col: j + 1 });
    } else if (char === '}' || char === ')' || char === ']') {
      if (stack.length === 0) {
        console.log(`Unmatched closing ${char} at line ${i + 1}`);
      } else {
        let last = stack[stack.length - 1];
        if ((char === '}' && last.char === '{') ||
            (char === ')' && last.char === '(') ||
            (char === ']' && last.char === '[')) {
          stack.pop();
        } else {
          console.log(`Mismatched ${char} at line ${i + 1}, expected closing for ${last.char} from line ${last.line}`);
          stack.pop();
        }
      }
    }
  }
}

if (stack.length > 0) {
  console.log('Unclosed brackets:');
  stack.slice(-5).forEach(s => console.log(`${s.char} at line ${s.line}`));
} else {
  console.log('All brackets match!');
}
